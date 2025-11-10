@echo off
echo.
echo ========================================
echo   ChatHub Local Testing Script
echo ========================================
echo.

setlocal_dir=%~dp0
cd %local_dir%

echo [INFO] Checking prerequisites...

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed. Please install Python 3.11+ first.
    echo Visit: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo [SUCCESS] Python is installed

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ first.
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)
echo [SUCCESS] Node.js is installed

:: Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker is not installed. Using local setup instead.
    set USE_DOCKER=false
) else (
    echo [SUCCESS] Docker is installed
    set USE_DOCKER=true
)

echo.
echo [INFO] Setting up local environment...

:: Create virtual environment for backend
if not exist backend\venv (
    echo [INFO] Creating Python virtual environment...
    cd backend
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [SUCCESS] Virtual environment created
) else (
    echo [INFO] Virtual environment already exists
)

:: Install backend dependencies
echo [INFO] Installing backend Python dependencies...
cd backend
call venv\Scripts\activate
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b 1
)
echo [SUCCESS] Backend dependencies installed

:: Create environment file if it doesn't exist
if not exist .env (
    echo [INFO] Creating .env file...
    echo # ChatHub Environment Variables > .env
    echo. >> .env
    echo FLASK_ENV=development >> .env
    echo SECRET_KEY=dev-secret-key-change-in-production >> .env
    echo DATABASE_URL=mongodb://localhost:27017/chatapp >> .env
    echo FRONTEND_URL=http://localhost:3000 >> .env
    echo TOTP_ISSUER=ChatHub >> .env
    echo REDIS_URL=redis://localhost:6379/0 >> .env
    echo NEXT_PUBLIC_API_URL=http://localhost:5000 >> .env
    echo NEXT_PUBLIC_APP_NAME=ChatHub >> .env
    echo [SUCCESS] Created .env file
) else (
    echo [INFO] .env file already exists
)

cd %local_dir%

:: Check if we should use Docker for databases
if "%USE_DOCKER%"=="true" (
    echo.
    echo [INFO] Starting databases with Docker...

    :: Start MongoDB
    docker run -d --name chathub-mongodb-local -p 27017:27017 mongo:7.0
    if errorlevel 1 (
        echo [ERROR] Failed to start MongoDB. Check if port 27017 is already in use.
        pause
        exit /b 1
    )
    echo [SUCCESS] MongoDB started on port 27017

    :: Start Redis
    docker run -d --name chathub-redis-local -p 6379:6379 redis:7.2-alpine
    if errorlevel 1 (
        echo [ERROR] Failed to start Redis. Check if port 6379 is already in use.
        pause
        exit /b 1
    )
    echo [SUCCESS] Redis started on port 6379

    :: Wait for databases to be ready
    echo [INFO] Waiting for databases to be ready...
    timeout /t 30 >nul
    echo [SUCCESS] Databases should be ready
) else (
    echo.
    echo [WARNING] Docker not available. Please start MongoDB and Redis manually.
    echo MongoDB: mongod --port 27017 --dbpath /path/to/data/db
    echo Redis: redis-server --port 6379
    pause
    echo Press any key to continue when databases are running...
)

:: Install frontend dependencies
echo [INFO] Installing frontend Node.js dependencies...
cd frontend
if not exist node_modules (
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
    echo [SUCCESS] Frontend dependencies installed
) else (
    echo [INFO] Frontend dependencies already installed
)

cd %local_dir%

:: Create logs directory
if not exist logs (
    mkdir logs
    echo [SUCCESS] Created logs directory
)

echo.
echo [INFO] Starting local development servers...

:: Start backend server
echo [INFO] Starting Flask backend server...
start "ChatHub Backend" /D cmd /c "cd backend && venv\Scripts\activate && python app.py"
timeout /t 5 >nul

:: Start frontend server
echo [INFO] Starting Next.js frontend server...
cd frontend
start "ChatHub Frontend" cmd /c "npm run dev"
cd %local_dir%

echo.
echo ========================================
echo   ChatHub Local Servers Started!
echo ========================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo MongoDB:  mongodb://localhost:27017
echo Redis:    redis://localhost:6379
echo.
echo [INFO] Servers are starting in separate windows.
echo [INFO] Close this window to shut down all servers.
echo.

:: Create stop script
echo @echo off > STOP_LOCAL.bat
echo echo. >> STOP_LOCAL.bat
echo echo [INFO] Stopping ChatHub local servers... >> STOP_LOCAL.bat
echo taskkill /f /im python.exe /fi "windowtitle eq 'ChatHub Backend'" >nul 2>&1 >> STOP_LOCAL.bat
echo taskkill /f /im node.exe /fi "windowtitle eq 'ChatHub Frontend'" >nul 2>&1 >> STOP_LOCAL.bat
echo if "%USE_DOCKER%"=="true" ( >> STOP_LOCAL.bat
echo     echo [INFO] Stopping Docker containers... >> STOP_LOCAL.bat
echo     docker stop chathub-mongodb-local chathub-redis-local >> STOP_LOCAL.bat
echo     docker rm chathub-mongodb-local chathub-redis-local >> STOP_LOCAL.bat
echo ) >> STOP_LOCAL.bat
echo echo [SUCCESS] All servers stopped. >> STOP_LOCAL.bat
echo pause >> STOP_LOCAL.bat

echo [INFO] To stop all servers, run: STOP_LOCAL.bat
echo [INFO] To view logs, check the logs/ directory

:: Wait for user to close
echo Press any key to exit this setup window...
pause >nul