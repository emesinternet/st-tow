#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$HOME/repos/st-tow"
HOST="127.0.0.1"
PORT="3000"
DATA_DIR="C:/temp/stdb-local/data"
STOP_ONLY="false"

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
    --data-dir)
      DATA_DIR="$2"
      shift 2
      ;;
    --stop-only)
      STOP_ONLY="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

echo "st-tow server launcher"
echo "repo: $REPO_DIR"
echo "listen: $HOST:$PORT"
echo "data: $DATA_DIR"

pkill -f spacetimedb-standalone >/dev/null 2>&1 || true
pkill -f "spacetime start" >/dev/null 2>&1 || true
taskkill.exe /F /IM spacetimedb-standalone.exe >/dev/null 2>&1 || true
taskkill.exe /F /IM spacetimedb-cli.exe >/dev/null 2>&1 || true
sleep 1

if [[ "$STOP_ONLY" == "true" ]]; then
  echo "Stopped local SpacetimeDB processes (if any)."
  exit 0
fi

if [[ "$DATA_DIR" =~ ^[A-Za-z]:/ ]]; then
  win_path="${DATA_DIR//\//\\}"
  cmd.exe /d /c "if not exist \"$win_path\" mkdir \"$win_path\"" >/dev/null 2>&1 || true
else
  mkdir -p "$DATA_DIR"
fi

exec spacetime start \
  --data-dir "$DATA_DIR" \
  --listen-addr "$HOST:$PORT" \
  --in-memory \
  --non-interactive
