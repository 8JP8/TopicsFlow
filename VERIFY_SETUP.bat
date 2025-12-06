@echo off
echo ========================================
echo TopicsFlow Setup Verification
echo ========================================
echo.

cd /d "%~dp0"

echo [1/5] Checking Python...
python --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found!
    pause
    exit /b 1
)
echo OK: Python installed
echo.

echo [2/5] Checking MongoDB connection...
python -c "from pymongo import MongoClient; import os; from dotenv import load_dotenv; load_dotenv('backend/.env'); client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/')); client.admin.command('ping'); print('OK: MongoDB connected')" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Could not connect to MongoDB
    echo Make sure MongoDB is running
    echo.
) else (
    echo OK: MongoDB connected
    echo.
)

echo [3/5] Checking backend dependencies...
cd backend
python -c "import flask, flask_socketio, pymongo, bcrypt, pyotp" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Some Python packages missing
    echo Run: pip install -r requirements.txt
    echo.
) else (
    echo OK: Backend dependencies installed
    echo.
)
cd ..

echo [4/5] Checking frontend dependencies...
cd frontend
if exist "node_modules\" (
    echo OK: Frontend dependencies installed
) else (
    echo WARNING: node_modules not found
    echo Run: npm install
)
echo.
cd ..

echo [5/5] Checking database schema...
python -c "from pymongo import MongoClient; import os; from dotenv import load_dotenv; load_dotenv('backend/.env'); client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/')); db = client[os.getenv('MONGO_DB_NAME', 'TopicsFlow')]; user = db.users.find_one(); has_admin = 'is_admin' in user if user else False; print('OK: Database schema updated' if has_admin else 'WARNING: Need to run migration'); exit(0 if has_admin else 1)" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Database needs migration
    echo Run: python migrate_new_features.py
    echo.
) else (
    echo OK: Database schema up to date
    echo.
)

echo ========================================
echo Verification Complete!
echo ========================================
echo.
echo Next steps:
echo 1. If migration needed: Run RUN_MIGRATION.bat
echo 2. Make user admin: python make_admin.py ^<username^>
echo 3. Start backend: cd backend ^&^& python app.py
echo 4. Start frontend: cd frontend ^&^& npm run dev
echo.
pause
