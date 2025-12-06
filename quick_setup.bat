@echo off
echo ============================================================
echo TopicsFlow Quick Setup Script
echo ============================================================
echo.

echo Step 1: Checking database connection...
python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017/'); client.admin.command('ping'); print('OK - MongoDB is running')" 2>nul
if errorlevel 1 (
    echo ERROR: MongoDB is not running
    echo Please start MongoDB first: net start MongoDB
    pause
    exit /b 1
)
echo.

echo Step 2: Running database migration...
python migrate_database.py migrate
if errorlevel 1 (
    echo ERROR: Migration failed
    pause
    exit /b 1
)
echo.

echo Step 3: Checking database status...
python migrate_database.py status
echo.

echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo Next steps:
echo 1. Make a user admin: python make_admin.py username
echo 2. Start backend: cd backend ^& python app.py
echo 3. Start frontend: cd frontend ^& npm run dev
echo.
echo Press any key to exit...
pause >nul
