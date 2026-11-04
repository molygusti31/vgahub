@echo off
setlocal
cd /d "%~dp0"

if not exist "Manager.exe" (
  echo Manager.exe not found. Run build-exe.bat and extract the ZIP first.
  pause
  exit /b 1
)
if not exist "start-dashboard.vbs" (
  echo start-dashboard.vbs not found. Rebuild and extract the ZIP again.
  pause
  exit /b 1
)

wscript.exe //nologo "%~dp0start-dashboard.vbs"
