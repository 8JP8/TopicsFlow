# Passwordless Authentication System

## Overview

The authentication system has been upgraded to use **passwordless authentication** with **TOTP (Time-based One-Time Password)** as the primary security method. Users no longer need passwords - they authenticate using their username/email and an authenticator app (like Google Authenticator, Authy, Microsoft Authenticator, etc.).

---

## Key Features

### ✅ Passwordless Authentication
- No passwords to remember or leak
- Login using username/email + 6-digit authenticator code
- More secure than traditional password-based systems

### ✅ Email Verification
- Email verification required during registration
- 6-digit verification codes sent via Resend email service
- Codes expire after 15 minutes

### ✅ TOTP (Time-based One-Time Passwords)
- Industry-standard 2FA using authenticator apps
- QR code scanning for easy setup
- Manual entry option for users who can't scan QR codes
- Backup codes for emergency access

### ✅ Secure Account Recovery
- Email verification + original TOTP secret for recovery
- No security questions or SMS recovery (more secure)
- User must have saved their original TOTP secret during setup

---

## Environment Setup

### 1. Resend API Key Configuration

Your Resend API key: `re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec`

#### For Local Development:

**Option A: Create/Update `.env` file (Recommended)**

```bash
cd backend
# Create .env file if it doesn't exist
touch .env

# Add the following line to your .env file
echo "RESEND_API_KEY=re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec" >> .env
echo "FROM_EMAIL=noreply@chathub.com" >> .env
echo "APP_NAME=ChatHub" >> .env
```

**Option B: Export as Environment Variable (Temporary)**

For Linux/Mac:
```bash
export RESEND_API_KEY=re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec
export FROM_EMAIL=noreply@chathub.com
export APP_NAME=ChatHub
```

For Windows CMD:
```cmd
set RESEND_API_KEY=re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec
set FROM_EMAIL=noreply@chathub.com
set APP_NAME=ChatHub
```

For Windows PowerShell:
```powershell
$env:RESEND_API_KEY="re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec"
$env:FROM_EMAIL="noreply@chathub.com"
$env:APP_NAME="ChatHub"
```

#### For Azure Deployment:

Add these environment variables in Azure App Service Configuration:

1. Go to Azure Portal → Your App Service → Configuration → Application settings
2. Click "+ New application setting"
3. Add:
   - Name: `RESEND_API_KEY` | Value: `re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec`
   - Name: `FROM_EMAIL` | Value: `noreply@chathub.com`
   - Name: `APP_NAME` | Value: `ChatHub`
4. Click "Save"

#### For Docker:

Add to your `docker-compose.yml`:

```yaml
environment:
  - RESEND_API_KEY=re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec
  - FROM_EMAIL=noreply@chathub.com
  - APP_NAME=ChatHub
```

Or pass via command line:
```bash
docker run -e RESEND_API_KEY=re_D3FqYGuy_3gPou6PoPHGnE4gwReKT8Vec \
           -e FROM_EMAIL=noreply@chathub.com \
           -e APP_NAME=ChatHub \
           your-image-name
```

### 2. Configure Verified Sender Email

**Important:** Resend requires you to verify your sender email domain before sending emails.

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add your domain (e.g., `chathub.com`)
3. Add the required DNS records to your domain
4. Wait for verification (usually a few minutes)
5. Update `FROM_EMAIL` in your `.env` to use your verified domain:
   ```
   FROM_EMAIL=noreply@yourdomain.com
   ```

For testing, you can also use Resend's email forwarding to your personal email.

---

## Authentication Flows

### Registration Flow (Multi-Step)

```
┌─────────────┐
│   Step 1    │
│ Enter Info  │
│ (Username,  │
│   Email)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 2    │
│   Verify    │
│   Email     │
│  (6-digit)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 3    │
│ Setup 2FA   │
│ (Scan QR    │
│  or Manual) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 4    │
│   Verify    │
│   TOTP      │
│  (6-digit)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 5    │
│   Backup    │
│   Codes     │
│  (Download) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Registration│
│  Complete!  │
└─────────────┘
```

**User Experience:**

1. **Step 1 - Enter Information**
   - User enters username and email
   - No password required!
   - System sends 6-digit code to email

2. **Step 2 - Verify Email**
   - User enters 6-digit code from email
   - "Resend Code" button available if code not received
   - Code expires in 15 minutes

3. **Step 3 - Setup Authenticator**
   - System displays QR code
   - User scans with authenticator app (Google Authenticator, Authy, etc.)
   - Manual entry option shown: "Can't scan? Enter this code: XXXXXXXXXXXX"
   - **IMPORTANT:** User must save this secret code for account recovery!

4. **Step 4 - Verify TOTP**
   - User enters 6-digit code from authenticator app
   - Confirms the app is set up correctly

5. **Step 5 - Backup Codes**
   - System shows 10 backup codes
   - User downloads/saves codes securely
   - These codes can be used if authenticator is lost

6. **Complete**
   - Registration complete
   - User redirected to login page

### Login Flow (Simple)

```
┌─────────────┐
│    Login    │
│             │
│ Username/   │
│   Email     │
│     +       │
│ Auth Code   │
│  (6-digit)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Logged    │
│     In!     │
└─────────────┘
```

**User Experience:**

1. User enters username or email
2. User opens authenticator app and gets current 6-digit code
3. User enters the code
4. Login complete!

### Recovery Flow

```
┌─────────────┐
│   Step 1    │
│    Enter    │
│    Email    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 2    │
│   Verify    │
│   Email     │
│  (6-digit)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 3    │
│    Enter    │
│  Original   │
│   Secret    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 4    │
│  Setup New  │
│    2FA      │
│ (Scan QR)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 5    │
│   Verify    │
│ New TOTP    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Step 6    │
│ New Backup  │
│   Codes     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Recovery   │
│  Complete!  │
└─────────────┘
```

**User Experience:**

1. **Step 1 - Enter Email**
   - User enters their registered email
   - System sends recovery code

2. **Step 2 - Verify Email**
   - User enters 6-digit code from email

3. **Step 3 - Enter Original Secret**
   - User enters the original TOTP secret they saved during registration
   - This proves they own the account
   - Format: Base32 string (e.g., "JBSWY3DPEHPK3PXP")

4. **Step 4-6 - Reset 2FA**
   - System generates new TOTP secret
   - User scans new QR code
   - Verifies with new code
   - Gets new backup codes

---

## API Endpoints

### Registration Endpoints

#### 1. Start Registration (Passwordless)
```http
POST /api/auth/register-passwordless
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com"
}

Response 201:
{
  "success": true,
  "user_id": "507f1f77bcf86cd799439011",
  "message": "Verification code sent to your email"
}
```

#### 2. Verify Email
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011",
  "code": "123456"
}

Response 200:
{
  "success": true,
  "message": "Email verified successfully",
  "totp_qr_data": "otpauth://totp/ChatHub:johndoe?secret=JBSWY3DPEHPK3PXP&issuer=ChatHub",
  "totp_secret": "JBSWY3DPEHPK3PXP",
  "user_id": "507f1f77bcf86cd799439011"
}
```

#### 3. Resend Verification Code
```http
POST /api/auth/resend-verification
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011"
}

Response 200:
{
  "success": true,
  "message": "Verification code resent successfully"
}
```

#### 4. Complete TOTP Setup
```http
POST /api/auth/complete-totp-setup
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011",
  "totp_code": "123456"
}

Response 200:
{
  "success": true,
  "message": "2FA enabled successfully",
  "backup_codes": [
    "12345678",
    "23456789",
    ...
  ]
}
```

### Login Endpoint

```http
POST /api/auth/login-passwordless
Content-Type: application/json

{
  "identifier": "johndoe",  // username or email
  "totp_code": "123456"
}

Response 200:
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "preferences": {...},
    "totp_enabled": true
  }
}
```

### Recovery Endpoints

#### 1. Initiate Recovery
```http
POST /api/auth/recovery/initiate-passwordless
Content-Type: application/json

{
  "email": "john@example.com"
}

Response 200:
{
  "success": true,
  "message": "If this email exists, a recovery code has been sent"
}
```

#### 2. Verify Recovery Email
```http
POST /api/auth/recovery/verify-email-code
Content-Type: application/json

{
  "email": "john@example.com",
  "code": "123456"
}

Response 200:
{
  "success": true,
  "message": "Recovery code verified",
  "user_id": "507f1f77bcf86cd799439011"
}
```

#### 3. Reset TOTP with Original Secret
```http
POST /api/auth/recovery/reset-totp
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011",
  "original_secret": "JBSWY3DPEHPK3PXP"
}

Response 200:
{
  "success": true,
  "message": "2FA reset successfully",
  "totp_qr_data": "otpauth://totp/...",
  "totp_secret": "NEWBASE32SECRET",
  "user_id": "507f1f77bcf86cd799439011"
}
```

#### 4. Complete Recovery TOTP Setup
```http
POST /api/auth/recovery/complete-totp-setup
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011",
  "totp_code": "123456",
  "new_secret": "NEWBASE32SECRET"
}

Response 200:
{
  "success": true,
  "message": "2FA recovery completed successfully",
  "backup_codes": [...]
}
```

---

## Security Features

### 1. **No Password Storage**
- Eliminates risks of password database breaches
- No need for password hashing, salting, etc.
- Reduces attack surface significantly

### 2. **TOTP Security**
- Time-based codes change every 30 seconds
- Resistant to replay attacks
- Industry-standard algorithm (RFC 6238)

### 3. **Email Verification**
- Prevents fake account creation
- Ensures user owns the email address
- Codes expire after 15 minutes

### 4. **Recovery Protection**
- Requires both email access AND original TOTP secret
- Two-factor recovery system
- Email notifications on 2FA reset

### 5. **Encrypted TOTP Secrets**
- TOTP secrets encrypted at rest using Fernet (symmetric encryption)
- Encryption key stored separately
- Even database breach won't expose secrets

### 6. **Backup Codes**
- One-time use emergency codes
- Hashed in database
- Removed after use

### 7. **Rate Limiting**
- Registration: 5/minute
- Login: 5/minute
- Email verification: 10/minute
- Resend codes: 3/minute
- Recovery: 3/minute

---

## User Instructions

### For Users Setting Up Their Account:

**⚠️ CRITICAL - SAVE YOUR TOTP SECRET!**

When you register, after verifying your email, you'll see:
1. A QR code to scan
2. A secret code like: `JBSWY3DPEHPK3PXP`

**YOU MUST SAVE THIS SECRET CODE!**

Options for saving:
- Write it down on paper and store securely
- Save in a password manager (1Password, LastPass, Bitwarden, etc.)
- Take a screenshot and store encrypted

**Why?** This is your ONLY way to recover your account if you lose your phone or authenticator app.

### Recommended Authenticator Apps:

- **Google Authenticator** (iOS, Android)
- **Microsoft Authenticator** (iOS, Android) - Recommended for cloud backup
- **Authy** (iOS, Android, Desktop) - Has cloud backup
- **1Password** (iOS, Android, Desktop) - Integrates with password manager
- **Bitwarden** (iOS, Android, Desktop) - Open source

### If You Lose Access to Your Authenticator:

1. Go to the recovery page
2. Enter your email → You'll receive a 6-digit code
3. Enter the code from your email
4. Enter the original TOTP secret you saved during setup
5. Set up a new authenticator with the new QR code
6. Save the new secret code!

---

## Testing the System

### 1. Test Email Sending

```bash
# In backend directory
python -c "
from services.email_service import EmailService
service = EmailService()
result = service.send_verification_email(
    'your-email@example.com',
    'testuser',
    '123456'
)
print(result)
"
```

### 2. Test Registration Flow

```bash
# Start backend
cd backend
python app.py

# In another terminal, test with curl:
curl -X POST http://localhost:5000/api/auth/register-passwordless \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com"}'
```

### 3. Generate QR Code Test

Install qrcode library:
```bash
pip install qrcode[pil]
```

Test QR generation:
```python
import pyotp
import qrcode

# Generate secret
secret = pyotp.random_base32()
print(f"Secret: {secret}")

# Create QR data
totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
    name='testuser',
    issuer_name='ChatHub'
)

# Generate QR code
qr = qrcode.make(totp_uri)
qr.save('test_qr.png')
print("QR code saved to test_qr.png")

# Test code generation
totp = pyotp.TOTP(secret)
print(f"Current code: {totp.now()}")
```

---

## Migration from Old System

If you have existing users with password-based accounts:

**Option 1: Force Migration**
- Require all users to complete passwordless setup on next login
- Provide clear instructions and deadline
- Disable password login after deadline

**Option 2: Gradual Migration**
- Keep both systems running
- New users use passwordless only
- Existing users can opt-in to passwordless
- Eventually deprecate password login

**Option 3: Automatic Migration**
- On next login with password, prompt user to set up TOTP
- After TOTP setup, remove password from database
- User must use passwordless from next login

**Current Implementation: Both systems coexist**
- Old endpoint: `/api/auth/login` (with password)
- New endpoint: `/api/auth/login-passwordless` (without password)
- You can keep both or remove the old one

---

## Troubleshooting

### Email Not Sending

1. Check Resend API key is set correctly:
   ```bash
   echo $RESEND_API_KEY
   ```

2. Check sender email is verified in Resend dashboard

3. Check logs for errors:
   ```bash
   tail -f backend/logs/app.log
   ```

### TOTP Code Not Working

1. **Clock Sync**: Ensure server and user device clocks are synced
   - TOTP is time-based and requires accurate time
   - Server should use NTP

2. **Wrong Secret**: User may have scanned wrong QR code
   - Have them re-scan or use manual entry

3. **Time Window**: Code is valid for ±30 seconds
   - Try code that just appeared
   - Don't reuse old codes

### Recovery Not Working

1. **Original Secret**: User must enter the EXACT secret from registration
   - Case-sensitive
   - No spaces
   - Base32 format (only letters A-Z and numbers 2-7)

2. **Email Issues**: Recovery code not received
   - Check spam folder
   - Verify email address is correct
   - Try resend

---

## Production Checklist

Before deploying to production:

- [ ] Set `RESEND_API_KEY` in production environment
- [ ] Verify sender domain in Resend
- [ ] Set `FROM_EMAIL` to verified domain
- [ ] Set strong `SECRET_KEY`
- [ ] Enable HTTPS (required for secure cookies)
- [ ] Set `SESSION_COOKIE_SECURE=True`
- [ ] Configure Redis for session storage (not filesystem)
- [ ] Set up monitoring for email delivery failures
- [ ] Configure rate limiting appropriately
- [ ] Test full registration flow end-to-end
- [ ] Test login flow
- [ ] Test recovery flow
- [ ] Create user documentation
- [ ] Train support team on new system
- [ ] Set up email templates in Resend dashboard (optional)
- [ ] Configure email delivery webhooks (optional)

---

## Support

For issues with:
- **Resend**: https://resend.com/docs
- **TOTP/OTP**: https://github.com/pyauth/pyotp
- **Frontend Implementation**: See frontend implementation guide (coming soon)

---

**Last Updated**: 2025-11-10
**Version**: 2.0 (Passwordless Authentication)
