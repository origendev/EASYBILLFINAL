@echo off
cd /d "%~dp0"
echo Closing any running EasyBill window...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM EasyBill.exe >nul 2>&1
if not exist node_modules (
  echo Installing dependencies - first run only, please wait...
  call npm install
)
echo Starting EasyBill...
call npm start
echo.
echo EasyBill has stopped. Copy any red error text above and send it for help.
pause
