# ===============================================
# Environment Variable Setup for ChatHub (TaskFlow)
# ===============================================
#
# This script sets environment variables for the ChatHub application
# on Windows systems using PowerShell.
#
# Usage:
#   Run as Administrator for system-wide variables:
#     powershell -ExecutionPolicy Bypass -File setup-env.ps1
#
#   Or run normally for user-specific variables
#

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  ChatHub Environment Setup" -ForegroundColor Cyan
Write-Host "  Domain: taskflow.pt" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$envVars = @{
    "RESEND_API_KEY" = "re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da"
    "FROM_EMAIL" = "chat@taskflow.pt"
    "APP_NAME" = "ChatHub"
    "FRONTEND_URL" = "http://localhost:3000"
    "DATABASE_URL" = "mongodb://localhost:27017/chatapp"
    "CORS_ALLOW_ALL" = "true"
}

# Set environment variables for current session
Write-Host "[INFO] Setting environment variables for current PowerShell session..." -ForegroundColor Yellow
Write-Host ""

foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    [Environment]::SetEnvironmentVariable($key, $value, "Process")

    if ($key -eq "RESEND_API_KEY") {
        Write-Host "  - $key : ****...g7Da (hidden for security)" -ForegroundColor Green
    } else {
        Write-Host "  - $key : $value" -ForegroundColor Green
    }
}

Write-Host ""

# Ask user if they want to set permanently
Write-Host "Do you want to set these variables PERMANENTLY for your user account?" -ForegroundColor Yellow
Write-Host "This will make them available in all future PowerShell sessions." -ForegroundColor Yellow
Write-Host ""

$response = Read-Host "Set permanently? (Y/N)"

if ($response -eq 'Y' -or $response -eq 'y') {
    Write-Host ""
    Write-Host "[INFO] Setting permanent environment variables for user account..." -ForegroundColor Yellow

    try {
        foreach ($key in $envVars.Keys) {
            [Environment]::SetEnvironmentVariable($key, $envVars[$key], "User")
        }

        Write-Host "[SUCCESS] Environment variables have been set permanently!" -ForegroundColor Green
        Write-Host ""
        Write-Host "NOTE: You need to restart your PowerShell for the permanent" -ForegroundColor Cyan
        Write-Host "      variables to take effect in new sessions." -ForegroundColor Cyan
        Write-Host "      The variables are already active in THIS session." -ForegroundColor Cyan
    }
    catch {
        Write-Host "[ERROR] Failed to set permanent variables: $_" -ForegroundColor Red
        Write-Host "Try running PowerShell as Administrator" -ForegroundColor Yellow
    }
}
else {
    Write-Host ""
    Write-Host "[INFO] Variables are set for this session only." -ForegroundColor Yellow
    Write-Host "      They will be lost when you close this PowerShell window." -ForegroundColor Yellow
}

# Create .env file
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Creating .env file in backend directory" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

if (-Not (Test-Path "backend")) {
    Write-Host "[WARNING] backend directory not found. Skipping .env file creation." -ForegroundColor Yellow
}
else {
    Write-Host "Creating backend/.env file..." -ForegroundColor Yellow

    $envContent = @"
# Flask Configuration
SECRET_KEY=your-secret-key-change-in-production
ENVIRONMENT=development

# Database Configuration
DATABASE_URL=mongodb://localhost:27017/chatapp
DB_NAME=chatapp

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# CORS Configuration
CORS_ALLOW_ALL=true

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Session Configuration
SESSION_TYPE=filesystem

# TOTP/2FA Configuration
TOTP_ISSUER=ChatHub
TOTP_VALIDITY_WINDOW=1

# Email Service (Resend)
RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
FROM_EMAIL=chat@taskflow.pt
APP_NAME=ChatHub

# Rate Limiting
LOGIN_RATE_LIMIT=5/minute
MESSAGE_RATE_LIMIT=30/minute

# Logging
LOG_LEVEL=INFO
"@

    $envContent | Out-File -FilePath "backend\.env" -Encoding UTF8
    Write-Host "[SUCCESS] Created backend/.env file" -ForegroundColor Green
}

# Display next steps
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Verify your domain (taskflow.pt) in Resend dashboard:" -ForegroundColor White
Write-Host "     https://resend.com/domains" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Add DNS records for taskflow.pt as shown in Resend" -ForegroundColor White
Write-Host ""
Write-Host "  3. Wait for domain verification (usually a few minutes)" -ForegroundColor White
Write-Host ""
Write-Host "  4. Start your backend:" -ForegroundColor White
Write-Host "     cd backend" -ForegroundColor Cyan
Write-Host "     python app.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "  5. Test email sending with Postman collection" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see: PASSWORDLESS_AUTH_SETUP.md" -ForegroundColor Yellow
Write-Host ""

# Keep window open
Read-Host "Press Enter to exit"
