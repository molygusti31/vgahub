@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
set "GUI_ENV=%TEMP%\vgahub-win-gui-env"
set "BUILD_ROOT=%TEMP%\vgahub-win-build-%RANDOM%-%RANDOM%"
set "GUI_DIST=%BUILD_ROOT%\gui"
set "PACKAGE_DIR=%BUILD_ROOT%\Dashboard-Windows"
set "PACKAGE_ZIP=%ROOT%dist\Dashboard-Windows.zip"

echo Installing packaging tools and dependencies...
call npm install
if errorlevel 1 (
  echo Failed to install Node.js dependencies.
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

where conda >nul 2>&1
if errorlevel 1 (
  echo.
  echo A Miniforge or Anaconda installation with conda is required to bundle
  echo the standalone GTK 4 Python GUI. Install conda and run this file again.
  pause
  exit /b 1
)

echo Preparing the standalone Python GTK 4 build environment...
if exist "%GUI_ENV%\conda-meta\history" (
  call conda env update --prefix "%GUI_ENV%" --file "%ROOT%environment-windows.yml" --prune
) else (
  call conda env create --prefix "%GUI_ENV%" --file "%ROOT%environment-windows.yml"
)
if errorlevel 1 (
  echo Failed to prepare the Python GTK 4 build environment.
  pause
  exit /b 1
)

if not exist "dist" mkdir "dist"
if not exist "%BUILD_ROOT%" mkdir "%BUILD_ROOT%"
echo Building Dashboard.exe with server files embedded...
call npm run build:exe
if errorlevel 1 (
  echo Server executable build failed.
  pause
  exit /b 1
)

echo Building the standalone Control Center from control_center.py...
call conda run --prefix "%GUI_ENV%" python -m PyInstaller --noconfirm --clean --windowed --onedir --name ControlCenter --distpath "%GUI_DIST%" --workpath "%BUILD_ROOT%\pyinstaller-work" --specpath "%BUILD_ROOT%" --collect-all gi --hidden-import gi.repository.Gtk --hidden-import gi.repository.Gdk "%ROOT%control_center.py"
if errorlevel 1 (
  echo Python GUI build failed.
  pause
  exit /b 1
)

if not exist "%PACKAGE_DIR%" mkdir "%PACKAGE_DIR%"
copy /Y "%ROOT%dist\Dashboard.exe" "%PACKAGE_DIR%\Dashboard.exe" >nul
if errorlevel 1 (
  echo Failed to copy Dashboard.exe into the portable package.
  pause
  exit /b 1
)
xcopy /E /I /Y "%GUI_DIST%\ControlCenter\*" "%PACKAGE_DIR%\" >nul
if errorlevel 1 (
  echo Failed to copy the Python GUI into the portable package.
  pause
  exit /b 1
)

if not exist "%PACKAGE_DIR%\bin" mkdir "%PACKAGE_DIR%\bin"
xcopy /E /I /Y "%GUI_ENV%\Library\bin\*" "%PACKAGE_DIR%\bin\" >nul
if errorlevel 1 (
  echo Failed to bundle GTK runtime libraries.
  pause
  exit /b 1
)
if exist "%GUI_ENV%\Library\lib\girepository-1.0" (
  xcopy /E /I /Y "%GUI_ENV%\Library\lib\girepository-1.0" "%PACKAGE_DIR%\lib\girepository-1.0" >nul
  if errorlevel 1 (
    echo Failed to bundle GTK introspection data.
    pause
    exit /b 1
  )
)
if exist "%GUI_ENV%\Library\lib\gtk-4.0" (
  xcopy /E /I /Y "%GUI_ENV%\Library\lib\gtk-4.0" "%PACKAGE_DIR%\lib\gtk-4.0" >nul
  if errorlevel 1 (
    echo Failed to bundle GTK modules.
    pause
    exit /b 1
  )
)
for %%D in (gtk-4.0 glib-2.0 icons themes locale) do (
  if exist "%GUI_ENV%\Library\share\%%D" (
    xcopy /E /I /Y "%GUI_ENV%\Library\share\%%D" "%PACKAGE_DIR%\share\%%D" >nul
    if errorlevel 1 (
      echo Failed to bundle GTK data files.
      pause
      exit /b 1
    )
  )
)
copy /Y "%ROOT%start-dashboard.bat" "%PACKAGE_DIR%\start-dashboard.bat" >nul
if errorlevel 1 (
  echo Failed to copy the Windows launcher.
  pause
  exit /b 1
)

(
  echo Dashboard Timbangan - Windows x64
  echo.
  echo Jalankan start-dashboard.bat untuk membuka Control Center.
  echo Dashboard.exe dan GUI Python GTK 4 sudah termasuk dalam paket.
  echo Runtime GTK dan Python juga dibundel; pengguna tidak perlu memasang Python atau GTK.
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
rmdir /S /Q "%BUILD_ROOT%"
echo Extract the ZIP to a writable folder before running it.
pause
