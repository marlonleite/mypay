#!/usr/bin/env bash
# Point this repo's git hooks at .githooks/ (one-time per clone).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

chmod +x .githooks/pre-push 2>/dev/null || true
git config core.hooksPath .githooks
echo "core.hooksPath set to .githooks (pre-push: Android install after push to main when adb device present)."
