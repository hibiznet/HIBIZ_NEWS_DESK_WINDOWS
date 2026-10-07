@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo HIBIZ News Desk - Windows EXE Build
echo ================================================

echo.
echo [1/4] Checking Node.js and npm...
node --version
if errorlevel 1 goto :error
npm --version
if errorlevel 1 goto :error

echo.
echo [2/4] Installing dependencies...
npm install
if errorlevel 1 goto :error

echo.
echo [3/4] Rebuilding better-sqlite3 for Electron...
npx electron-rebuild -f -w better-sqlite3
if errorlevel 1 goto :error

echo.
echo [4/4] Building Windows NSIS installer...
npm run dist
if errorlevel 1 goto :error

echo.
echo ================================================
echo BUILD SUCCESS
 echo.
echo Installer should be in:
echo %~dp0release\
echo.
dir /b release\*.exe 2>nul
if errorlevel 1 echo EXE file was not found. Check the build log.
echo ================================================
pause
exit /b 0

:error
echo.
echo ================================================
echo BUILD FAILED
 echo Please check the error above.
echo ================================================
pause
exit /b 1
