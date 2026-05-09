#!/usr/bin/env bash
# One-shot: build web once → Android debug APK + macOS .app, install to device + /Applications.
# From repo root: npm run native:install
# Optional: SKIP_ELECTRON=1  |  SKIP_ANDROID=1

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_NAME="myPay.app"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

install_electron() {
  echo "==> Electron: electron-builder --mac dir (app descompactado; evita só .dmg)"
  npx electron-builder --mac dir

  local found
  found=""
  local best=0
  while IFS= read -r -d '' path; do
    local m
    m="$(stat -f '%m' "$path" 2>/dev/null || echo 0)"
    if [[ "$m" -ge "$best" ]]; then
      best=$m
      found=$path
    fi
  done < <(find "$ROOT/dist-electron" -name "$APP_NAME" -type d -print0 2>/dev/null)

  if [[ -z "$found" || ! -d "$found" ]]; then
    echo "ERRO: não achei $APP_NAME após o build. Conteúdo de dist-electron/:"
    ls -la "$ROOT/dist-electron" 2>/dev/null || true
    exit 1
  fi
  echo "    App gerado: $found"

  echo "==> Electron: encerrar myPay se estiver aberto (para substituir em /Applications)"
  osascript -e 'tell application "myPay" to quit' 2>/dev/null || true
  sleep 1

  echo "==> Electron: /Applications via ditto"
  rm -rf "/Applications/$APP_NAME"
  ditto "$found" "/Applications/$APP_NAME"
  echo "    OK: /Applications/$APP_NAME"
}

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

if [[ "${SKIP_ELECTRON:-}" != 1 ]]; then
  install_electron
else
  echo "==> SKIP_ELECTRON=1 — pulando Electron"
fi

if [[ "${SKIP_ANDROID:-}" != 1 ]]; then
  install_android
else
  echo "==> SKIP_ANDROID=1 — pulando Android"
fi

echo "==> Concluído."
