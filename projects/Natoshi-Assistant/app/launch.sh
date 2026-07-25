#!/usr/bin/env bash
# Launch Matrix Terminal (always-on-top floating chat)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
export PYTHONUNBUFFERED=1
# optional keys — set in your shell or ~/.config/matrix-terminal.env
if [[ -f "$HOME/.config/matrix-terminal.env" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.config/matrix-terminal.env"
fi
exec python3 "$DIR/matrix_terminal.py"
