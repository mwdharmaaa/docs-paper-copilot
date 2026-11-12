# Windows PowerShell Extension Dev Runner
$ErrorActionPreference = "Stop"

Write-Host "=========================================================="
Write-Host "[*] Docs Paper Copilot - PowerShell Runner"
Write-Host "=========================================================="

$extPath = $PSScriptRoot
$chromeBin = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (-not (Test-Path $chromeBin)) {
    $chromeBin = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (-not (Test-Path $chromeBin)) {
    Write-Error "[x] Google Chrome executable not found."
    exit 1
}

$devProfile = Join-Path $env:TEMP "chrome-docs-copilot-dev"
if (-not (Test-Path $devProfile)) {
    New-Item -ItemType Directory -Force -Path $devProfile | Out-Null
}

Write-Host "[*] Launching Chrome with extension: $extPath"
$chromeArgs = @(
    "--load-extension=$extPath",
    "--user-data-dir=$devProfile",
    "https://docs.google.com/document/u/0/"
)
Start-Process -FilePath $chromeBin -ArgumentList $chromeArgs
Write-Host "[OK] Chrome dispatched successfully with active Docs Paper Copilot extension."
