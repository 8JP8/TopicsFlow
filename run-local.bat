@echo off
REM ========================================
REM   ChatApp - Local Development
REM ========================================

echo.
echo ========================================
echo   Starting ChatApp Locally
echo ========================================
echo.

REM Set environment variable for local mode
cd /d "%~dp0backend"
if not exist .env (
    echo FORCE_LOCAL_MODE=true > .env
    echo DATABASE_URL=mongodb://localhost:27017/chatapp >> .env
)

REM Start Backend
echo [1/2] Starting Backend...
echo   Backend will run on: http://localhost:5000
echo.
start "ChatApp Backend" cmd /k "cd /d %~dp0backend && python app.py"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [2/2] Starting Frontend...
echo   Frontend will run on: http://localhost:3000
echo.
start "ChatApp Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   ChatApp Started Successfully!
echo ========================================
echo.
echo Backend API:  http://localhost:5000
echo Frontend UI:  http://localhost:3000
echo.
echo Press Ctrl+C in each window to stop
echo ========================================
echo.
pause
