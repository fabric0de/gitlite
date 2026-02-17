#!/usr/bin/env sh

set -eu

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$ROOT_DIR" ]; then
  echo "Error: this script must be run inside a git repository." >&2
  exit 1
fi

cd "$ROOT_DIR"
git config core.hooksPath .githooks

echo "Git hooks are configured."
echo "core.hooksPath=$(git config --get core.hooksPath)"
