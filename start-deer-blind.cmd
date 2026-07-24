@echo off
rem ============================================================
rem  Deer Blind launcher — serves the console and opens it
rem  Put this file in the same folder as deer-blind.html
rem ============================================================
setlocal
cd /d "%~dp0"
set PORT=4173

where py >nul 2>nul
if %errorlevel%==0 ( set "PY=py" & goto serve )
where python >nul 2>nul
if %errorlevel%==0 ( set "PY=python" & goto serve )
echo Python not found. Install it (winget install Python.Python.3.12) or serve this
echo folder with any static server, then open http://localhost:%PORT%/deer-blind.html
pause
exit /b 1

:serve
echo Deer Blind on http://localhost:%PORT%/deer-blind.html
echo Gateway note: the gateway is expected on localhost:8001 (see README.md)
start "" "http://localhost:%PORT%/deer-blind.html#gw=http://localhost:8001&mode=live"
%PY% -m http.server %PORT%
