@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer to run the calculator map service.
  echo Offline calculations are still available by opening index.html.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:8765 after the service starts.
echo Keep this window open while using the calculator. Press Ctrl+C to stop.
node server.js
pause
