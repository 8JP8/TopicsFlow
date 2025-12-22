@echo off
echo ==========================================
echo MongoDB Repair Tool
echo ==========================================
echo.
echo Stopping any running mongod instances...
taskkill /F /IM mongod.exe >nul 2>&1

echo.
echo Attempting to repair MongoDB (using default PATH)...
mongod --repair
if %errorlevel% neq 0 (
    echo.
    echo 'mongod' not found in PATH or repair failed.
    echo Trying common installation paths...
    
    if exist "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" (
        "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --repair
    ) else if exist "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" (
        "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --repair
    ) else if exist "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" (
        "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" --repair
    ) else (
        echo.
        echo COUD NOT FIND MONGODB. Please ensure it is installed.
    )
)

echo.
echo Repair attempt finished.
echo You can now try to start the service or run 'mongod' manually.
echo.
pause
