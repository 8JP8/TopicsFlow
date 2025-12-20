@echo off
title TopicsFlow Auto-Launcher
echo ==============================================
echo   Starting TopicsFlow Development Environment
echo   Servers initiating... please wait
echo ==============================================
echo.
echo Backend and Frontend will start minimized.
echo You can access the app from any device on the network.
echo.
echo To find your server IP, run: ipconfig
echo.
echo IMPORTANT: Using LOCAL configuration only
echo (Azure configurations are disabled)
echo.

REM Clear all Azure-related environment variables for this session
REM This ensures no Azure resources will be accessed
set AZURE_COSMOS_CONNECTIONSTRING=
set AZURE_COSMOS_DATABASE=
set AZURE_DEPLOYMENT=
set FORCE_AZURE_MODE=

REM Set local mode configuration explicitly
set FORCE_LOCAL_MODE=true
set DATABASE_URL=mongodb://localhost:27017/TopicsFlow

REM Set Flask to development/local mode
set FLASK_ENV=development
set FLASK_DEBUG=True
set PORT=5000

REM Set environment variables for local mode in .env
cd /d "%~dp0backend"
if not exist .env (
    echo FORCE_LOCAL_MODE=true > .env
    echo DATABASE_URL=mongodb://localhost:27017/TopicsFlow >> .env
)

REM Start Backend (minimized) with local environment
start "TopicsFlow Backend" /min cmd /k "cd /d %~dp0backend && python app.py"

REM Wait for backend to initialize
timeout /t 2 /nobreak >nul

REM Start Frontend (minimized) with Next.js dev server
start "TopicsFlow Frontend" /min cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Servers initiating...
echo.
echo Backend API:  http://localhost:5000
echo Frontend UI:  http://localhost:3000
echo.
echo Both servers are running minimized.
echo Check the taskbar for terminal windows.
echo.
echo Closing this window in 3 seconds...
timeout /t 3 /nobreak >nul
exit
