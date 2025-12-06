@echo off
echo ============================================================
echo Testing TopicsFlow Implementation
echo ============================================================
echo.

echo Step 1: Running database migration...
python migrate_admin_system_complete.py
if errorlevel 1 (
    echo ERROR: Migration failed!
    pause
    exit /b 1
)
echo.

echo Step 2: Testing backend compilation...
cd backend
python -m py_compile app.py
if errorlevel 1 (
    echo ERROR: Backend compilation failed!
    pause
    exit /b 1
)
cd ..
echo Backend compiles successfully!
echo.

echo Step 3: Testing frontend compilation...
cd frontend
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
cd ..
echo Frontend compiles successfully!
echo.

echo ============================================================
echo All tests passed!
echo ============================================================
echo.
echo You can now start the application:
echo - Backend: python backend/app.py
echo - Frontend: cd frontend && npm run dev
echo.
pause
