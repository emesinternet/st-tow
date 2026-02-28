#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <db_name> [--repo <repo>] [--host <host>] [--spacetime-port <port>] [--web-port <port>]"
  exit 2
fi

DB_NAME="$1"
shift

REPO_DIR="$HOME/repos/st-tow"
HOST="127.0.0.1"
SPACETIME_PORT="3000"
WEB_PORT="5173"

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
    --spacetime-port)
      SPACETIME_PORT="$2"
      shift 2
      ;;
    --web-port)
      WEB_PORT="$2"
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
WEB_LOG="$RUN_DIR/web.log"

mkdir -p "$RUN_DIR"

echo "st-tow web launcher"
echo "db: $DB_NAME"
echo "run dir: $RUN_DIR"

for _ in $(seq 1 300); do
  if [[ -f "$FAIL_FILE" ]]; then
    echo "Publish/generate failed."
    echo "publish log: $PUBLISH_LOG"
    echo "generate log: $GENERATE_LOG"
    [[ -f "$PUBLISH_LOG" ]] && tail -n 120 "$PUBLISH_LOG"
    [[ -f "$GENERATE_LOG" ]] && tail -n 120 "$GENERATE_LOG"
    exit 1
  fi
  if [[ -f "$READY_FILE" ]]; then
    break
  fi
  sleep 1
done

if [[ ! -f "$READY_FILE" ]]; then
  echo "Timed out waiting for publish/generate."
  exit 1
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "nvm not found at $NVM_DIR/nvm.sh"
  exit 1
fi

# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm install 22 >/dev/null
nvm use 22 >/dev/null

cd "$REPO_DIR/web"
export VITE_SPACETIMEDB_DB_NAME="$DB_NAME"
export VITE_SPACETIMEDB_HOST="ws://$HOST:$SPACETIME_PORT"

echo "Starting Vite on http://$HOST:$WEB_PORT"
npm run dev -- --host "$HOST" --port "$WEB_PORT" 2>&1 | tee "$WEB_LOG"
