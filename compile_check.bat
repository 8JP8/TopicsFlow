@echo off
echo ============================================================
echo Backend Compilation Check
echo ============================================================
echo.

echo Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)
echo.

echo Checking backend files for syntax errors...
echo.

cd backend

echo Checking models...
python -m py_compile models/user.py
if errorlevel 1 (
    echo ERROR in models/user.py
    pause
    exit /b 1
)
echo [OK] models/user.py

python -m py_compile models/report.py
if errorlevel 1 (
    echo ERROR in models/report.py
    pause
    exit /b 1
)
echo [OK] models/report.py

python -m py_compile models/ticket.py
if errorlevel 1 (
    echo ERROR in models/ticket.py
    pause
    exit /b 1
)
echo [OK] models/ticket.py

python -m py_compile models/conversation_settings.py
if errorlevel 1 (
    echo ERROR in models/conversation_settings.py
    pause
    exit /b 1
)
echo [OK] models/conversation_settings.py

echo.
echo Checking routes...
python -m py_compile routes/admin.py
if errorlevel 1 (
    echo ERROR in routes/admin.py
    pause
    exit /b 1
)
echo [OK] routes/admin.py

python -m py_compile routes/reports.py
if errorlevel 1 (
    echo ERROR in routes/reports.py
    pause
    exit /b 1
)
echo [OK] routes/reports.py

python -m py_compile routes/tickets.py
if errorlevel 1 (
    echo ERROR in routes/tickets.py
    pause
    exit /b 1
)
echo [OK] routes/tickets.py

python -m py_compile routes/topics.py
if errorlevel 1 (
    echo ERROR in routes/topics.py
    pause
    exit /b 1
)
echo [OK] routes/topics.py

python -m py_compile routes/chat_rooms.py
if errorlevel 1 (
    echo ERROR in routes/chat_rooms.py
    pause
    exit /b 1
)
echo [OK] routes/chat_rooms.py

python -m py_compile routes/users.py
if errorlevel 1 (
    echo ERROR in routes/users.py
    pause
    exit /b 1
)
echo [OK] routes/users.py

echo.
echo Checking utilities...
python -m py_compile utils/admin_middleware.py
if errorlevel 1 (
    echo ERROR in utils/admin_middleware.py
    pause
    exit /b 1
)
echo [OK] utils/admin_middleware.py

echo.
echo Checking main app...
python -m py_compile app.py
if errorlevel 1 (
    echo ERROR in app.py
    pause
    exit /b 1
)
echo [OK] app.py

cd ..

echo.
echo ============================================================
echo SUCCESS: All backend files compiled successfully!
echo ============================================================
echo.
echo You can now start the backend with: python backend/app.py
echo.
pause
