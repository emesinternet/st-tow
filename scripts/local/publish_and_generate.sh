#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <db_name> [--repo <repo>] [--host <host>] [--port <port>] [--stage-root-win <path>]"
  exit 2
fi

DB_NAME="$1"
shift

REPO_DIR="$HOME/repos/st-tow"
HOST="127.0.0.1"
PORT="3000"
STAGE_ROOT_WIN="C:/temp/sttow-module"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_DIR="$2"
      shift 2
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --stage-root-win)
      STAGE_ROOT_WIN="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

RUN_DIR="/tmp/sttow/$DB_NAME"
READY_FILE="$RUN_DIR/ready.flag"
FAIL_FILE="$RUN_DIR/fail.flag"
BUILD_LOG="$RUN_DIR/build.log"
PUBLISH_LOG="$RUN_DIR/publish.log"
GENERATE_LOG="$RUN_DIR/generate.log"
STAGE_SERVER_WIN="${STAGE_ROOT_WIN%/}/server"
STAGE_SERVER_WSL=""
JS_PATH_WIN="${STAGE_SERVER_WIN%/}/dist/bundle.js"
JS_PATH_WSL=""

mkdir -p "$RUN_DIR"
rm -f "$READY_FILE" "$FAIL_FILE" "$BUILD_LOG" "$PUBLISH_LOG" "$GENERATE_LOG"

echo "st-tow publish+generate"
echo "db: $DB_NAME"
echo "run dir: $RUN_DIR"
echo "stage win: $STAGE_SERVER_WIN"

if ! command -v rsync >/dev/null 2>&1; then
  echo "missing rsync in WSL environment" | tee "$FAIL_FILE"
  exit 1
fi

if ! STAGE_SERVER_WSL="$(wslpath "$STAGE_SERVER_WIN" 2>/dev/null)"; then
  echo "failed to convert stage windows path to WSL path: $STAGE_SERVER_WIN" | tee "$FAIL_FILE"
  exit 1
fi

if ! JS_PATH_WSL="$(wslpath "$JS_PATH_WIN" 2>/dev/null)"; then
  echo "failed to convert js windows path to WSL path: $JS_PATH_WIN" | tee "$FAIL_FILE"
  exit 1
fi

{
  echo "Staging server module into $STAGE_SERVER_WIN"
  mkdir -p "$STAGE_SERVER_WSL"
  rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    "$REPO_DIR/server/" "$STAGE_SERVER_WSL/"
} >"$BUILD_LOG" 2>&1 || {
  cat "$BUILD_LOG"
  echo "server stage failed" | tee "$FAIL_FILE"
  exit 1
}

{
  echo "Installing server dependencies in Windows staging path..."
  cmd.exe /d /s /c "cd /d ${STAGE_SERVER_WIN//\//\\} && npm install --silent"
  echo "Building staged server module..."
  spacetime build -p "$STAGE_SERVER_WIN"
} >>"$BUILD_LOG" 2>&1 || {
  cat "$BUILD_LOG"
  echo "build failed" | tee "$FAIL_FILE"
  exit 1
}

if [[ ! -f "$JS_PATH_WSL" ]]; then
  cat "$BUILD_LOG"
  echo "missing built bundle after build: $JS_PATH_WIN" | tee "$FAIL_FILE"
  exit 1
fi

publish_ok=false
for attempt in $(seq 1 60); do
  {
    echo "Publishing to DB: $DB_NAME (attempt $attempt/60)"
    spacetime publish "$DB_NAME" --server local -y --anonymous --js-path "$JS_PATH_WIN"
  } >"$PUBLISH_LOG" 2>&1 && publish_ok=true && break

  if grep -Eiq 'connect|connection refused|timed out|No connection could be made|os error 10061|server not ready' "$PUBLISH_LOG"; then
    sleep 1
    continue
  fi

  break
done

if [[ "$publish_ok" != true ]]; then
  cat "$PUBLISH_LOG"
  echo "publish failed" | tee "$FAIL_FILE"
  exit 1
fi

cat "$BUILD_LOG"
cat "$PUBLISH_LOG"

{
  echo "Generating web bindings..."
  cd "$REPO_DIR/web"
  spacetime generate --lang typescript --out-dir src/module_bindings --js-path "$JS_PATH_WIN"
} >"$GENERATE_LOG" 2>&1 || {
  cat "$GENERATE_LOG"
  echo "generate failed" | tee "$FAIL_FILE"
  exit 1
}

cat "$GENERATE_LOG"
date -Iseconds >"$READY_FILE"
echo "Publish + generate complete."
