@echo off
REM TopicsFlow Backend API Test Runner
REM This script clears test data and runs Postman collection tests

echo ========================================
echo TopicsFlow Backend API Test Suite
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Python not found. Skipping database cleanup.
    echo You may need to manually clear test data from MongoDB.
    goto :skip_cleanup
)

REM Step 1: Clear test data from database
echo [1/4] Clearing test data from database...
echo.
python clear_test_data.py
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Failed to clear test data. Continuing anyway...
    echo.
)
echo.

:skip_cleanup

REM Step 2: Check if Newman is installed
echo [2/4] Checking Newman installation...
where newman >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Newman not found. Installing...
    call npm install -g newman
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install Newman
        pause
        exit /b 1
    )
)
echo ✓ Newman is installed
echo.

REM Step 3: Check if HTML reporter is installed
echo [3/4] Checking HTML reporter...
call npm list -g newman-reporter-html >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo HTML reporter not found. Installing...
    call npm install -g newman-reporter-html
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Failed to install HTML reporter. Tests will run without HTML report.
    ) else (
        echo ✓ HTML reporter installed
    )
) else (
    echo ✓ HTML reporter is installed
)
echo.

REM Step 4: Create reports directory if it doesn't exist
if not exist "Tests\reports" (
    mkdir Tests\reports
)

REM Step 5: Run Postman collection tests
echo [4/4] Running Postman collection tests...
echo.
echo ========================================
echo Running Tests...
echo ========================================
echo.

newman run Tests\postman\TopicsFlow_Backend_API.postman_collection.json ^
    -e Tests\postman\environments\Local.postman_environment.json ^
    -r html,cli ^
    --reporter-html-export Tests\reports\report.html ^
    --delay-request 500

set TEST_EXIT_CODE=%ERRORLEVEL%

echo.
echo ========================================
if %TEST_EXIT_CODE% EQU 0 (
    echo ✓ All tests passed!
) else (
    echo ✗ Some tests failed. Exit code: %TEST_EXIT_CODE%
)
echo ========================================
echo.
echo Test report saved to: Tests\reports\report.html
echo.

REM Open report in browser (optional)
if exist "Tests\reports\report.html" (
    echo Opening test report in browser...
    start Tests\reports\report.html
)

pause
exit /b %TEST_EXIT_CODE%
