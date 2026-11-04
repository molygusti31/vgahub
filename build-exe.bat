@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
set "BUILD_ROOT=%TEMP%\vgahub-win-package-%RANDOM%-%RANDOM%"
set "PACKAGE_DIR=%BUILD_ROOT%\Dashboard-Windows"
set "PACKAGE_ZIP=%ROOT%dist\Dashboard-Windows.zip"

if not exist "%ROOT%node_modules\.bin\pkg.cmd" (
  echo Installing packaging tools and dependencies...
  call npm install
  if errorlevel 1 (
    echo Failed to install Node.js dependencies.
    pause
    exit /b 1
  )
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

if not exist "%ROOT%dist" mkdir "%ROOT%dist"
echo Building Manager.exe with server files embedded...
call npm run build:exe
if errorlevel 1 (
  echo Server executable build failed.
  pause
  exit /b 1
)

mkdir "%PACKAGE_DIR%"
copy /Y "%ROOT%dist\Manager.exe" "%PACKAGE_DIR%\Manager.exe" >nul
if errorlevel 1 (
  echo Failed to copy Manager.exe into the portable package.
  pause
  exit /b 1
)
if not exist "%PACKAGE_DIR%\control-center" mkdir "%PACKAGE_DIR%\control-center"
xcopy /E /I /Y "%ROOT%control-center\*" "%PACKAGE_DIR%\control-center\" >nul
if errorlevel 1 (
  echo Failed to copy the HTML Control Center files.
  pause
  exit /b 1
)
copy /Y "%ROOT%start-dashboard.bat" "%PACKAGE_DIR%\start-dashboard.bat" >nul
if errorlevel 1 (
  echo Failed to copy the Windows batch launcher.
  pause
  exit /b 1
)
copy /Y "%ROOT%start-dashboard.vbs" "%PACKAGE_DIR%\start-dashboard.vbs" >nul
if errorlevel 1 (
  echo Failed to copy the Windows GUI launcher.
  pause
  exit /b 1
)

(
  echo Dashboard Timbangan - Windows x64
  echo.
  echo Jalankan start-dashboard.vbs atau start-dashboard.bat untuk membuka Control Center.
  echo Manager.exe menjalankan server di latar belakang tanpa jendela terminal.
  echo Tampilan HTML, CSS, dan JavaScript ada di folder control-center.
  echo Control Center dibuka menggunakan browser default; GTK dan Python tidak diperlukan.
  echo.
  echo Port, database, dan log disimpan di folder ini. Pastikan folder dapat ditulis.
) > "%PACKAGE_DIR%\README.txt"

echo Creating the portable Windows ZIP...
set "VG_PACKAGE_DIR=%PACKAGE_DIR%"
set "VG_PACKAGE_ZIP=%PACKAGE_ZIP%"
powershell -NoProfile -Command "Compress-Archive -Path (Join-Path $env:VG_PACKAGE_DIR '*') -DestinationPath $env:VG_PACKAGE_ZIP -Force"
if errorlevel 1 (
  echo Failed to create the portable ZIP package.
  pause
  exit /b 1
)

echo.
echo Build complete:
echo   Portable ZIP: %PACKAGE_ZIP%
echo Extract the ZIP to a writable folder before running it.
rmdir /S /Q "%BUILD_ROOT%"
pause
