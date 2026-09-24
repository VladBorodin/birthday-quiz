@echo off
setlocal
cd /d "%~dp0"

set PORT=8765
set PY_CMD=

where py >nul 2>nul
if %ERRORLEVEL%==0 set PY_CMD=py -3

if not defined PY_CMD (
    where python >nul 2>nul
    if %ERRORLEVEL%==0 set PY_CMD=python
)

if not defined PY_CMD (
    echo.
    echo [ERROR] Python ne naiden.
    echo.
    pause
    exit /b 1
)

start "Birthday Quiz Server" cmd /k "%PY_CMD% -m http.server %PORT% --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/admin.html"
start "" "http://127.0.0.1:%PORT%/screen.html"

endlocal
