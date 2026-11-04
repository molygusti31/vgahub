@echo off
setlocal
cd /d "%~dp0"

if not exist "ControlCenter.exe" (
  echo ControlCenter.exe not found. Run build-exe.bat first.
  pause
  exit /b 1
)

if not exist "Dashboard.exe" (
  echo Dashboard.exe not found. Run build-exe.bat first.
  pause
  exit /b 1
)

start "" "%~dp0ControlCenter.exe"
