#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-$HOME/repos/st-tow}"

ok=true

check_cmd() {
  local cmd="$1"
  local label="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '[OK] %s: %s\n' "$label" "$(command -v "$cmd")"
  else
    printf '[FAIL] %s: command not found (%s)\n' "$label" "$cmd"
    ok=false
  fi
}

check_path() {
  local path="$1"
  local label="$2"
  if [[ -e "$path" ]]; then
    printf '[OK] %s: %s\n' "$label" "$path"
  else
    printf '[FAIL] %s: missing path (%s)\n' "$label" "$path"
    ok=false
  fi
}

echo "st-tow doctor"
echo "repo: $REPO_DIR"
echo

check_cmd spacetime "Spacetime CLI"
check_cmd npm "npm"
check_cmd bash "bash"

if command -v nvm >/dev/null 2>&1; then
  echo "[OK] nvm: available in shell"
elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  echo "[OK] nvm: install found at $HOME/.nvm/nvm.sh (loadable)"
else
  echo "[FAIL] nvm: not found and $HOME/.nvm/nvm.sh missing"
  ok=false
fi

check_path "$REPO_DIR" "Repo root"
check_path "$REPO_DIR/server/package.json" "Server package"
check_path "$REPO_DIR/web/package.json" "Web package"
check_path "$REPO_DIR/scripts/local/start_server.sh" "Server script"
check_path "$REPO_DIR/scripts/local/publish_and_generate.sh" "Publish script"
check_path "$REPO_DIR/scripts/local/start_web.sh" "Web script"

echo
if [[ "$ok" == true ]]; then
  echo "Doctor checks passed."
  exit 0
fi

echo "Doctor checks failed."
exit 1
