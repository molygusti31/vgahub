@echo off
setlocal
cd /d "%~dp0"

echo Installing packaging tools and dependencies...
call npm install
if errorlevel 1 (
  echo Failed to install dependencies.
  pause
  exit /b 1
)

where patch >nul 2>&1
if errorlevel 1 if exist "C:\Program Files\Git\usr\bin\patch.exe" set "PATH=C:\Program Files\Git\usr\bin;%PATH%"
where patch >nul 2>&1
if errorlevel 1 (
  echo.
  echo Build requires patch.exe, normally included with Git for Windows.
  echo Install Git for Windows, reopen this window, and run this file again.
  echo Download: https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist "dist" mkdir "dist"
echo Building Dashboard.exe with public files embedded...
call npm run build:exe
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete: %~dp0dist\Dashboard.exe
echo Copy this EXE to a writable folder before running it.
pause