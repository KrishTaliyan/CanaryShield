# Starts the whole FlagGuard stack for local development.
# Run from the repo root:  .\dev-start.ps1
# Each app opens in its own PowerShell window so you can see its logs.
# Close a window (or Ctrl+C inside it) to stop that one app.

$ErrorActionPreference = "Stop"
$repo = $PSScriptRoot
$go = "C:\Program Files\Go\bin\go.exe"

Write-Host "Starting Docker infra (Postgres, Redis, Prometheus)..." -ForegroundColor Cyan
docker compose -f "$repo\docker-compose.yml" up -d

function Start-App($title, $workDir, $command) {
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$title'; cd '$workDir'; $command"
    )
}

Write-Host "Starting platform backend (Go, :8080)..." -ForegroundColor Cyan
Start-App "FlagGuard: platform" "$repo\platform" "& '$go' run ./cmd/server"
Start-Sleep -Seconds 2

Write-Host "Starting QuickCart server (Node, :4000)..." -ForegroundColor Cyan
Start-App "FlagGuard: quickcart-server" "$repo\quickcart\server" "node src/index.js"

Write-Host "Starting dashboard (Vite, :5173)..." -ForegroundColor Cyan
Start-App "FlagGuard: dashboard" "$repo\dashboard" "npm run dev"

Write-Host "Starting QuickCart web (Vite, :5174)..." -ForegroundColor Cyan
Start-App "FlagGuard: quickcart-web" "$repo\quickcart\web" "npm run dev"

Write-Host ""
Write-Host "All apps starting in their own windows. Give them ~5-10 seconds, then open:" -ForegroundColor Green
Write-Host "  Dashboard:  http://localhost:5173"
Write-Host "  QuickCart:  http://localhost:5174"
Write-Host ""
Write-Host "Optional (real traffic for charts/guardian demo):" -ForegroundColor Yellow
Write-Host "  cd loadgen; & '$go' run . -rps 30"
