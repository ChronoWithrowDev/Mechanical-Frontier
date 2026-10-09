$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host ''
Write-Host 'Mechanical Frontier - Windows installer builder' -ForegroundColor Cyan
Write-Host 'This script is for making the installer, not for playing the installed game.'
Write-Host 'Players who install the generated Setup.exe do not need Node.js.'
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Build prerequisite missing: Node.js is needed on the computer that builds the installer. It is NOT required on the player computer after Setup.exe has been created.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm was not found. Reinstall Node.js from https://nodejs.org/ on the build computer.'
}

Write-Host '[1/3] Installing the build dependencies...' -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }

Write-Host '[2/3] Building the production game and Windows installer...' -ForegroundColor Yellow
npm run dist:win
if ($LASTEXITCODE -ne 0) { throw "Windows installer build failed with exit code $LASTEXITCODE" }

$Installer = Get-ChildItem (Join-Path $Root 'dist-installer') -Filter 'Mechanical-Frontier-Setup-*.exe' -File | Select-Object -First 1
if (-not $Installer) { throw 'The build completed without producing the expected Setup.exe.' }
Write-Host ''
Write-Host "Installer created: $($Installer.FullName)" -ForegroundColor Green
Write-Host 'Copy this Setup.exe to the player computer. Node.js is not needed there.' -ForegroundColor Green
