@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js LTS from https://nodejs.org first.
  echo Then double-click this file again.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo Please update Node.js to version 22.13 or a newer LTS release.
  pause
  exit /b 1
)
echo Installing test-server dependencies. Internet is required for this step.
call npm ci --omit=dev
if errorlevel 1 (
  echo Installation failed. Check the internet connection, then try again.
  pause
  exit /b 1
)
node scripts/start-test-server.mjs
pause
