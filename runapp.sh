#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_PROFILE="${TEMP:-/tmp}/chrome-docs-copilot-dev"

CHROME_BIN=""
if command -v google-chrome &>/dev/null; then
    CHROME_BIN="$(command -v google-chrome)"
elif command -v google-chrome-stable &>/dev/null; then
    CHROME_BIN="$(command -v google-chrome-stable)"
elif command -v chromium-browser &>/dev/null; then
    CHROME_BIN="$(command -v chromium-browser)"
elif [[ -f "/c/Program Files/Google/Chrome/Application/chrome.exe" ]]; then
    CHROME_BIN="/c/Program Files/Google/Chrome/Application/chrome.exe"
elif [[ -f "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" ]]; then
    CHROME_BIN="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
fi

if [[ -z "$CHROME_BIN" ]]; then
    echo "[x] Google Chrome executable not found."
    exit 1
fi

mkdir -p "$DEV_PROFILE"
echo "=========================================================="
echo "[*] Launching Chrome with Docs Paper Copilot: $SCRIPT_DIR"
echo "=========================================================="
"$CHROME_BIN" --load-extension="$SCRIPT_DIR" --user-data-dir="$DEV_PROFILE" "https://docs.google.com/document/u/0/" &
echo "[OK] Chrome dispatched successfully."
