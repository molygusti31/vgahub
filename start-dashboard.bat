@echo off
setlocal
cd /d "%~dp0"

if not exist "dist\Dashboard.exe" (
  echo Dashboard.exe not found. Run build-exe.bat first.
  pause
  exit /b 1
)

start "Dashboard" "%~dp0dist\Dashboard.exe"
timeout /t 2 /nobreak >nul
start "" "http://localhost:5534"