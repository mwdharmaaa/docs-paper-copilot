# PowerShell Integrity Verification Test
$ErrorActionPreference = "Stop"

Write-Host "=========================================================="
Write-Host "[*] Checking Extension File Integrity..."
Write-Host "=========================================================="

$requiredFiles = @(
    "manifest.json",
    "background.js",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "src/content/docs_observer.js",
    "src/content/docs_bridge.js",
    "src/core/storage_service.js",
    "src/core/prompt_templates.js",
    "src/core/ai_client.js",
    "src/sidepanel/sidepanel.html",
    "src/sidepanel/sidepanel.css",
    "src/sidepanel/sidepanel.js",
    "src/sidepanel/diff_viewer.js",
    "src/sidepanel/action_handlers.js",
    "apps-script/Code.js",
    "apps-script/Sidebar.html",
    "apps-script/appsscript.json"
)

$root = $PSScriptRoot
$missing = 0

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $root $file
    if (Test-Path $fullPath) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $file is missing" -ForegroundColor Red
        $missing++
    }
}

if ($missing -gt 0) {
    Write-Error "[x] $missing required file(s) missing."
    exit 1
}

# Validate JSON files
Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json | Out-Null
Get-Content (Join-Path $root "apps-script/appsscript.json") -Raw | ConvertFrom-Json | Out-Null
Write-Host "  [OK] Manifest and appsscript JSON valid." -ForegroundColor Green

Write-Host "=========================================================="
Write-Host "[OK] All extension integrity checks passed." -ForegroundColor Green
Write-Host "=========================================================="
