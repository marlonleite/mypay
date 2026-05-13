#!/usr/bin/env bash
# Points git hooks at .githooks/. Safe on npm install (no-op outside a git checkout).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${SKIP_PREPARE_HOOKS:-}" == 1 ]]; then
  exit 0
fi

if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

if [[ ! -f "$ROOT/.githooks/pre-push" ]]; then
  exit 0
fi

chmod +x "$ROOT/.githooks/pre-push" 2>/dev/null || true
git -C "$ROOT" config core.hooksPath .githooks || true
echo "hooks: core.hooksPath set to .githooks (pre-push → native:install on push to main when adb has a device)"
