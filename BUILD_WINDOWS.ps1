$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host '================================================' -ForegroundColor Cyan
Write-Host 'HIBIZ News Desk - Windows EXE Build' -ForegroundColor Cyan
Write-Host '================================================' -ForegroundColor Cyan

node --version
npm --version

Write-Host '[1/3] npm install' -ForegroundColor Yellow
npm install

Write-Host '[2/3] electron-rebuild (better-sqlite3)' -ForegroundColor Yellow
npx electron-rebuild -f -w better-sqlite3

Write-Host '[3/3] electron-builder NSIS' -ForegroundColor Yellow
npm run dist

Write-Host ''
Write-Host 'BUILD SUCCESS' -ForegroundColor Green
Write-Host "Installer folder: $PSScriptRoot\release" -ForegroundColor Green
Get-ChildItem "$PSScriptRoot\release\*.exe" -ErrorAction SilentlyContinue | Select-Object FullName,Length
