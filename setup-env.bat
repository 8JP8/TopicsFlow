@echo off
REM ===============================================
REM Environment Variable Setup for ChatHub (TaskFlow)
REM ===============================================
REM
REM This script sets environment variables for the ChatHub application
REM on Windows systems using Command Prompt.
REM
REM Usage: Run this script as Administrator for system-wide variables
REM        Or run normally for user-specific variables
REM

echo ===============================================
echo   ChatHub Environment Setup
echo   Domain: taskflow.pt
echo ===============================================
echo.

REM Set environment variables for current session
set RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
set FROM_EMAIL=chat@taskflow.pt
set APP_NAME=ChatHub
set FRONTEND_URL=http://localhost:3000
set DATABASE_URL=mongodb://localhost:27017/chatapp
set CORS_ALLOW_ALL=true

echo [INFO] Setting environment variables for current session...
echo   - RESEND_API_KEY: ****...g7Da (hidden for security)
echo   - FROM_EMAIL: chat@taskflow.pt
echo   - APP_NAME: ChatHub
echo   - FRONTEND_URL: http://localhost:3000
echo   - DATABASE_URL: mongodb://localhost:27017/chatapp
echo   - CORS_ALLOW_ALL: true
echo.

REM Ask user if they want to set permanently
echo.
echo Do you want to set these variables PERMANENTLY for your user account?
echo This will make them available in all future Command Prompt sessions.
echo.
choice /C YN /M "Set permanently (Y/N)"

if errorlevel 2 goto :skip_permanent
if errorlevel 1 goto :set_permanent

:set_permanent
echo.
echo [INFO] Setting permanent environment variables for user account...

setx RESEND_API_KEY "re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da" >nul 2>&1
setx FROM_EMAIL "chat@taskflow.pt" >nul 2>&1
setx APP_NAME "ChatHub" >nul 2>&1
setx FRONTEND_URL "http://localhost:3000" >nul 2>&1
setx DATABASE_URL "mongodb://localhost:27017/chatapp" >nul 2>&1
setx CORS_ALLOW_ALL "true" >nul 2>&1

echo [SUCCESS] Environment variables have been set permanently!
echo.
echo NOTE: You need to restart your Command Prompt for the permanent
echo       variables to take effect in new sessions.
echo       The variables are already active in THIS session.
goto :create_env_file

:skip_permanent
echo.
echo [INFO] Variables are set for this session only.
echo       They will be lost when you close this Command Prompt.
goto :create_env_file

:create_env_file
echo.
echo ===============================================
echo   Creating .env file in backend directory
echo ===============================================

if not exist "backend" (
    echo [WARNING] backend directory not found. Skipping .env file creation.
    goto :finish
)

echo Creating backend/.env file...

(
echo # Flask Configuration
echo SECRET_KEY=your-secret-key-change-in-production
echo ENVIRONMENT=development
echo.
echo # Database Configuration
echo DATABASE_URL=mongodb://localhost:27017/chatapp
echo DB_NAME=chatapp
echo.
echo # Frontend Configuration
echo FRONTEND_URL=http://localhost:3000
echo.
echo # CORS Configuration
echo CORS_ALLOW_ALL=true
echo.
echo # Redis Configuration
echo REDIS_URL=redis://localhost:6379/0
echo.
echo # Session Configuration
echo SESSION_TYPE=filesystem
echo.
echo # TOTP/2FA Configuration
echo TOTP_ISSUER=ChatHub
echo TOTP_VALIDITY_WINDOW=1
echo.
echo # Email Service ^(Resend^)
echo RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
echo FROM_EMAIL=chat@taskflow.pt
echo APP_NAME=ChatHub
echo.
echo # Rate Limiting
echo LOGIN_RATE_LIMIT=5/minute
echo MESSAGE_RATE_LIMIT=30/minute
echo.
echo # Logging
echo LOG_LEVEL=INFO
) > backend\.env

echo [SUCCESS] Created backend/.env file
echo.

:finish
echo ===============================================
echo   Setup Complete!
echo ===============================================
echo.
echo Next Steps:
echo   1. Verify your domain (taskflow.pt) in Resend dashboard:
echo      https://resend.com/domains
echo.
echo   2. Add DNS records for taskflow.pt as shown in Resend
echo.
echo   3. Wait for domain verification (usually a few minutes)
echo.
echo   4. Start your backend:
echo      cd backend
echo      python app.py
echo.
echo   5. Test email sending with Postman collection
echo.
echo For more information, see: PASSWORDLESS_AUTH_SETUP.md
echo.
pause
