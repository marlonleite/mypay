#!/usr/bin/env bash
# One-shot: build web once → Android debug APK, install via USB.
# From repo root: npm run native:install
# Optional: SKIP_ANDROID=1 (only vite build + cap sync)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

install_android() {
  echo "==> Android: assembleDebug"
  (cd "$ROOT/android" && ./gradlew assembleDebug)

  if [[ ! -f "$APK" ]]; then
    echo "ERRO: APK não encontrado: $APK"
    exit 1
  fi

  if ! command -v adb >/dev/null 2>&1; then
    echo "ERRO: adb não está no PATH."
    exit 1
  fi

  local ready
  ready="$(adb devices | awk '/\tdevice$/ {c++} END {print c+0}')"
  if [[ "$ready" -lt 1 ]]; then
    echo "ERRO: nenhum dispositivo em 'device' (adb devices)."
    adb devices
    exit 1
  fi

  echo "==> Android: adb install -r"
  adb install -r "$APK"
  echo "    OK: app-debug.apk"
}

echo "==> Vite build + Capacitor sync (uma vez)"
npm run build
npx cap sync android

if [[ "${SKIP_ANDROID:-}" != 1 ]]; then
  install_android
else
  echo "==> SKIP_ANDROID=1 — pulando instalação Android"
fi

echo "==> Concluído."
