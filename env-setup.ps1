# Prompt-based environment setup (safe to commit; does not contain secrets).

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  TopicsFlow Prompt Env Setup" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

function Get-PlainTextFromSecureString([Security.SecureString]$secure) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$FROM_EMAIL = Read-Host "FROM_EMAIL (e.g. noreply@topicsflow.me)"
$FRONTEND_URL = Read-Host "FRONTEND_URL (default http://localhost:3000)"
if ([string]::IsNullOrWhiteSpace($FRONTEND_URL)) { $FRONTEND_URL = "http://localhost:3000" }

$DATABASE_URL = Read-Host "DATABASE_URL (default mongodb://localhost:27017/TopicsFlow)"
if ([string]::IsNullOrWhiteSpace($DATABASE_URL)) { $DATABASE_URL = "mongodb://localhost:27017/TopicsFlow" }

$RESEND_SEC = Read-Host "RESEND_API_KEY" -AsSecureString
$TENOR_SEC = Read-Host "TENOR_API_KEY (optional)" -AsSecureString

$USE_IMGBB = "false"
$IMGBB_API_KEY = ""
$IMGBB_EXPIRATION_SECONDS = "600"
$IMGBB_MAX_BASE64_SIZE_BYTES = "2097152"

$enableImgBb = Read-Host "Enable ImgBB? (Y/N)"
if ($enableImgBb -eq "Y" -or $enableImgBb -eq "y") {
    $USE_IMGBB = "true"
    $IMGBB_SEC = Read-Host "IMGBB_API_KEY" -AsSecureString
    $IMGBB_API_KEY = Get-PlainTextFromSecureString $IMGBB_SEC
}

$RESEND_API_KEY = Get-PlainTextFromSecureString $RESEND_SEC
$TENOR_API_KEY = Get-PlainTextFromSecureString $TENOR_SEC

[Environment]::SetEnvironmentVariable("RESEND_API_KEY", $RESEND_API_KEY, "Process")
[Environment]::SetEnvironmentVariable("FROM_EMAIL", $FROM_EMAIL, "Process")
[Environment]::SetEnvironmentVariable("FRONTEND_URL", $FRONTEND_URL, "Process")
[Environment]::SetEnvironmentVariable("DATABASE_URL", $DATABASE_URL, "Process")
[Environment]::SetEnvironmentVariable("TENOR_API_KEY", $TENOR_API_KEY, "Process")
[Environment]::SetEnvironmentVariable("USE_IMGBB", $USE_IMGBB, "Process")
[Environment]::SetEnvironmentVariable("IMGBB_API_KEY", $IMGBB_API_KEY, "Process")
[Environment]::SetEnvironmentVariable("IMGBB_EXPIRATION_SECONDS", $IMGBB_EXPIRATION_SECONDS, "Process")
[Environment]::SetEnvironmentVariable("IMGBB_MAX_BASE64_SIZE_BYTES", $IMGBB_MAX_BASE64_SIZE_BYTES, "Process")

Write-Host ""
Write-Host "[INFO] Env vars set for this session:" -ForegroundColor Yellow
Write-Host "  - RESEND_API_KEY: (set)" -ForegroundColor Green
Write-Host "  - FROM_EMAIL: $FROM_EMAIL" -ForegroundColor Green
Write-Host "  - FRONTEND_URL: $FRONTEND_URL" -ForegroundColor Green
Write-Host "  - DATABASE_URL: $DATABASE_URL" -ForegroundColor Green
Write-Host "  - TENOR_API_KEY: (set/empty)" -ForegroundColor Green
Write-Host "  - USE_IMGBB: $USE_IMGBB" -ForegroundColor Green
Write-Host "  - IMGBB_API_KEY: (set/empty)" -ForegroundColor Green

$perm = Read-Host "Set permanently for your user? (Y/N)"
if ($perm -eq "Y" -or $perm -eq "y") {
    [Environment]::SetEnvironmentVariable("RESEND_API_KEY", $RESEND_API_KEY, "User")
    [Environment]::SetEnvironmentVariable("FROM_EMAIL", $FROM_EMAIL, "User")
    [Environment]::SetEnvironmentVariable("FRONTEND_URL", $FRONTEND_URL, "User")
    [Environment]::SetEnvironmentVariable("DATABASE_URL", $DATABASE_URL, "User")
    [Environment]::SetEnvironmentVariable("TENOR_API_KEY", $TENOR_API_KEY, "User")
    [Environment]::SetEnvironmentVariable("USE_IMGBB", $USE_IMGBB, "User")
    [Environment]::SetEnvironmentVariable("IMGBB_API_KEY", $IMGBB_API_KEY, "User")
    [Environment]::SetEnvironmentVariable("IMGBB_EXPIRATION_SECONDS", $IMGBB_EXPIRATION_SECONDS, "User")
    [Environment]::SetEnvironmentVariable("IMGBB_MAX_BASE64_SIZE_BYTES", $IMGBB_MAX_BASE64_SIZE_BYTES, "User")
    Write-Host "[SUCCESS] Permanent env vars set." -ForegroundColor Green
}

if (Test-Path "backend") {
    $envContent = @"
# Flask Configuration
SECRET_KEY=your-secret-key-change-in-production
ENVIRONMENT=development

# Database Configuration
DATABASE_URL=$DATABASE_URL
DB_NAME=TopicsFlow

# Frontend Configuration
FRONTEND_URL=$FRONTEND_URL

# CORS Configuration
CORS_ALLOW_ALL=true

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Session Configuration
SESSION_TYPE=filesystem

# TOTP/2FA Configuration
TOTP_ISSUER=TopicsFlow
TOTP_VALIDITY_WINDOW=1

# Email Service (Resend)
RESEND_API_KEY=$RESEND_API_KEY
FROM_EMAIL=$FROM_EMAIL
APP_NAME=TopicsFlow

# GIF Service (Tenor)
TENOR_API_KEY=$TENOR_API_KEY
TENOR_CLIENT_KEY=topicsflow_app

# ImgBB (optional)
USE_IMGBB=$USE_IMGBB
IMGBB_API_KEY=$IMGBB_API_KEY
IMGBB_EXPIRATION_SECONDS=$IMGBB_EXPIRATION_SECONDS
IMGBB_MAX_BASE64_SIZE_BYTES=$IMGBB_MAX_BASE64_SIZE_BYTES
"@

    $envContent | Out-File -FilePath "backend/.env" -Encoding utf8
    Write-Host "[SUCCESS] Wrote backend/.env" -ForegroundColor Green
} else {
    Write-Host "[WARN] backend/ not found; skipped backend/.env creation" -ForegroundColor Yellow
}


