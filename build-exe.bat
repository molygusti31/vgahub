@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
set "ELECTRON_OUTPUT=%TEMP%\vgahub-electron-%RANDOM%-%RANDOM%"

if not exist "%ROOT%node_modules\.bin\pkg.cmd" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Failed to install Node.js dependencies.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%node_modules\.bin\electron-builder.cmd" (
  echo Installing Electron packaging tools...
  call npm install
  if errorlevel 1 (
    echo Failed to install Electron packaging tools.
    pause
    exit /b 1
  )
)

for /f %%V in ('node -p "process.versions.modules"') do set "NODE_MODULE_ABI=%%V"
if not "%NODE_MODULE_ABI%"=="137" (
  echo.
  echo Building the embedded server requires Node.js 24.x with ABI 137.
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo Building the native SQLite module required by the embedded server...
  call npm rebuild better-sqlite3
  if errorlevel 1 (
    echo Failed to build the native SQLite module.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo The native SQLite module is missing after the rebuild.
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

if not exist "%ROOT%build" mkdir "%ROOT%build"
if not exist "%ROOT%dist" mkdir "%ROOT%dist"
echo Preparing the Windows application icon...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%build-app-icon.ps1" -Source "%ROOT%control-center\vgahub.ico" -Destination "%ROOT%build\vgahub.ico"
if errorlevel 1 (
  echo Failed to prepare the Windows application icon.
  pause
  exit /b 1
)

echo Building the desktop application with embedded server and Control Center...
call npm run build:exe -- --config.directories.output="%ELECTRON_OUTPUT%"
if errorlevel 1 (
  echo Desktop application build failed.
  pause
  exit /b 1
)

copy /Y "%ELECTRON_OUTPUT%\Dashboard-Windows.exe" "%ROOT%dist\Dashboard-Windows.exe" >nul
if errorlevel 1 (
  echo Failed to copy the desktop application into dist.
  pause
  exit /b 1
)
del /Q "%ROOT%build\Manager.exe" >nul
del /Q "%ROOT%build\vgahub.ico" >nul
rmdir /S /Q "%ELECTRON_OUTPUT%"

echo.
echo Build complete:
echo   Desktop application: %ROOT%dist\Dashboard-Windows.exe
echo Control Center HTML, CSS, and JavaScript are embedded in the application package.
pause
