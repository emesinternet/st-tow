#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <db_name> [--repo <repo>] [--host <host>] [--port <port>]"
  exit 2
fi

DB_NAME="$1"
shift

REPO_DIR="$HOME/repos/st-tow"
HOST="127.0.0.1"
PORT="3000"

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
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

RUN_DIR="/tmp/sttow/$DB_NAME"
READY_FILE="$RUN_DIR/ready.flag"
FAIL_FILE="$RUN_DIR/fail.flag"
PUBLISH_LOG="$RUN_DIR/publish.log"
GENERATE_LOG="$RUN_DIR/generate.log"
JS_PATH="$REPO_DIR/server/dist/bundle.js"
JS_PATH_WIN=""

mkdir -p "$RUN_DIR"
rm -f "$READY_FILE" "$FAIL_FILE" "$PUBLISH_LOG" "$GENERATE_LOG"

echo "st-tow publish+generate"
echo "db: $DB_NAME"
echo "run dir: $RUN_DIR"

if [[ ! -f "$JS_PATH" ]]; then
  echo "missing bundle: $JS_PATH" | tee "$FAIL_FILE"
  exit 1
fi

if ! JS_PATH_WIN="$(wslpath -w "$JS_PATH" 2>/dev/null)"; then
  echo "failed to convert bundle path to windows path: $JS_PATH" | tee "$FAIL_FILE"
  exit 1
fi

if [[ -z "$JS_PATH_WIN" ]]; then
  echo "empty windows bundle path for: $JS_PATH" | tee "$FAIL_FILE"
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
