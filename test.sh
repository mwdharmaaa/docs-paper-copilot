#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=========================================================="
echo "[*] Validating Docs Paper Copilot Integrity..."
echo "=========================================================="

test -f manifest.json || { echo "[x] Missing manifest.json"; exit 1; }
test -f background.js || { echo "[x] Missing background.js"; exit 1; }
test -f icons/icon16.png || { echo "[x] Missing icon16.png"; exit 1; }
test -f icons/icon48.png || { echo "[x] Missing icon48.png"; exit 1; }
test -f icons/icon128.png || { echo "[x] Missing icon128.png"; exit 1; }
test -f src/content/docs_observer.js || { echo "[x] Missing docs_observer.js"; exit 1; }
test -f src/content/docs_bridge.js || { echo "[x] Missing docs_bridge.js"; exit 1; }
test -f src/core/storage_service.js || { echo "[x] Missing storage_service.js"; exit 1; }
test -f src/core/prompt_templates.js || { echo "[x] Missing prompt_templates.js"; exit 1; }
test -f src/core/ai_client.js || { echo "[x] Missing ai_client.js"; exit 1; }
test -f src/sidepanel/sidepanel.html || { echo "[x] Missing sidepanel.html"; exit 1; }
test -f src/sidepanel/sidepanel.css || { echo "[x] Missing sidepanel.css"; exit 1; }
test -f src/sidepanel/sidepanel.js || { echo "[x] Missing sidepanel.js"; exit 1; }
test -f src/sidepanel/diff_viewer.js || { echo "[x] Missing diff_viewer.js"; exit 1; }
test -f src/sidepanel/action_handlers.js || { echo "[x] Missing action_handlers.js"; exit 1; }

echo "=========================================================="
echo "[OK] All extension integrity checks passed."
echo "=========================================================="
