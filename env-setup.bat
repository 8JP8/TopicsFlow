@echo off
REM Prompt-based environment setup (safe to commit; does not contain secrets).

echo ===============================================
echo   TopicsFlow Prompt Env Setup
echo ===============================================
echo.

set /p FROM_EMAIL=FROM_EMAIL (e.g. noreply@topicsflow.me): 
set /p FRONTEND_URL=FRONTEND_URL (default http://localhost:3000): 
if "%FRONTEND_URL%"=="" set FRONTEND_URL=http://localhost:3000

set /p DATABASE_URL=DATABASE_URL (default mongodb://localhost:27017/TopicsFlow): 
if "%DATABASE_URL%"=="" set DATABASE_URL=mongodb://localhost:27017/TopicsFlow

echo.
set /p RESEND_API_KEY=RESEND_API_KEY: 
set /p TENOR_API_KEY=TENOR_API_KEY (optional): 

set USE_IMGBB=false
set IMGBB_API_KEY=
set IMGBB_EXPIRATION_SECONDS=
set IMGBB_MAX_BASE64_SIZE_BYTES=2097152

echo.
choice /C YN /M "Enable ImgBB (Y/N)"
if errorlevel 2 goto :skip_imgbb
if errorlevel 1 goto :enable_imgbb

:enable_imgbb
set USE_IMGBB=true
set /p IMGBB_API_KEY=IMGBB_API_KEY: 

:skip_imgbb
echo.
echo [INFO] Setting env vars for this session...
set APP_NAME=TopicsFlow
set CORS_ALLOW_ALL=true

echo   - RESEND_API_KEY: **** (hidden)
echo   - FROM_EMAIL: %FROM_EMAIL%
echo   - FRONTEND_URL: %FRONTEND_URL%
echo   - DATABASE_URL: %DATABASE_URL%
echo   - TENOR_API_KEY: **** (hidden)
echo   - USE_IMGBB: %USE_IMGBB%
echo   - IMGBB_API_KEY: **** (hidden)
echo.

choice /C YN /M "Set permanently for your user account (Y/N)"
if errorlevel 2 goto :create_env
if errorlevel 1 goto :set_perm

:set_perm
echo.
echo [INFO] Setting permanent environment variables for user account...
setx RESEND_API_KEY "%RESEND_API_KEY%" >nul 2>&1
setx FROM_EMAIL "%FROM_EMAIL%" >nul 2>&1
setx APP_NAME "%APP_NAME%" >nul 2>&1
setx FRONTEND_URL "%FRONTEND_URL%" >nul 2>&1
setx DATABASE_URL "%DATABASE_URL%" >nul 2>&1
setx CORS_ALLOW_ALL "%CORS_ALLOW_ALL%" >nul 2>&1
setx TENOR_API_KEY "%TENOR_API_KEY%" >nul 2>&1
setx USE_IMGBB "%USE_IMGBB%" >nul 2>&1
setx IMGBB_API_KEY "%IMGBB_API_KEY%" >nul 2>&1
setx IMGBB_EXPIRATION_SECONDS "%IMGBB_EXPIRATION_SECONDS%" >nul 2>&1
setx IMGBB_MAX_BASE64_SIZE_BYTES "%IMGBB_MAX_BASE64_SIZE_BYTES%" >nul 2>&1
echo [SUCCESS] Permanent env vars set.

:create_env
echo.
if not exist "backend" (
  echo [WARN] backend folder not found; skipping backend/.env creation.
  goto :finish
)

echo [INFO] Writing backend/.env ...
(
echo # Flask Configuration
echo SECRET_KEY=your-secret-key-change-in-production
echo ENVIRONMENT=development
echo.
echo # Database Configuration
echo DATABASE_URL=%DATABASE_URL%
echo DB_NAME=TopicsFlow
echo.
echo # Frontend Configuration
echo FRONTEND_URL=%FRONTEND_URL%
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
echo TOTP_ISSUER=TopicsFlow
echo TOTP_VALIDITY_WINDOW=1
echo.
echo # Email Service ^(Resend^)
echo RESEND_API_KEY=%RESEND_API_KEY%
echo FROM_EMAIL=%FROM_EMAIL%
echo APP_NAME=TopicsFlow
echo.
echo # GIF Service ^(Tenor^)
echo TENOR_API_KEY=%TENOR_API_KEY%
echo TENOR_CLIENT_KEY=topicsflow_app
echo.
echo # ImgBB ^(optional^)
echo USE_IMGBB=%USE_IMGBB%
echo IMGBB_API_KEY=%IMGBB_API_KEY%
echo IMGBB_EXPIRATION_SECONDS=%IMGBB_EXPIRATION_SECONDS%
echo IMGBB_MAX_BASE64_SIZE_BYTES=%IMGBB_MAX_BASE64_SIZE_BYTES%
) > backend\.env

echo [SUCCESS] Wrote backend/.env

:finish
echo.
echo Done.


