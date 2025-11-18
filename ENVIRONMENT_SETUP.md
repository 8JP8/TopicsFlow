# Environment Setup Guide

This guide explains how to set up your environment variables for the ChatHub application using the automated setup scripts.

## Quick Start

### Windows Users

**Option 1: Command Prompt (Recommended)**
```cmd
setup-env.bat
```

**Option 2: PowerShell**
```powershell
powershell -ExecutionPolicy Bypass -File setup-env.ps1
```

### Linux/Mac Users

```bash
chmod +x setup-env.sh
./setup-env.sh
```

Or to set variables in your current shell:
```bash
source setup-env.sh
```

---

## What These Scripts Do

The setup scripts will:

1. **Set environment variables for the current session:**
   - `RESEND_API_KEY` - Your Resend email API key
   - `FROM_EMAIL` - Sender email address (chat@taskflow.pt)
   - `APP_NAME` - Application name (ChatHub)
   - `FRONTEND_URL` - Frontend URL (http://localhost:3000)
   - `DATABASE_URL` - MongoDB connection string
   - `CORS_ALLOW_ALL` - Enable CORS for development
   - `TENOR_API_KEY` - Tenor GIF API key for GIF search functionality

2. **Ask if you want to set them permanently:**
   - **Windows**: Uses `setx` to set user environment variables
   - **Linux/Mac**: Adds exports to your `.bashrc` or `.zshrc`

3. **Create a `.env` file in the backend directory:**
   - Contains all configuration for the Flask application
   - Ready to use immediately

---

## Configuration Details

### Resend Email Service

- **API Key**: `re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da`
- **Domain**: `taskflow.pt`
- **Sender Email**: `chat@taskflow.pt`

### Important: Domain Verification Required

Before emails will send, you **must** verify your domain in Resend:

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter `taskflow.pt`
4. Add the DNS records shown by Resend to your domain provider
5. Wait for verification (usually 5-15 minutes)

**DNS Records You'll Need to Add:**

Resend will provide records similar to these:

```
Type: TXT
Name: _resend (or @)
Value: resend-verify=<verification-code>

Type: CNAME
Name: resend._domainkey
Value: resend._domainkey.resend.com

Type: MX
Name: @
Value: feedback-smtp.us-east-1.amazonses.com (Priority: 10)
```

**Where to Add DNS Records:**

If you manage `taskflow.pt` through:
- **Cloudflare**: DNS → Add Record
- **GoDaddy**: DNS Management → Add Record
- **Namecheap**: Advanced DNS → Add New Record
- **AWS Route 53**: Hosted Zones → Create Record
- **Google Domains**: DNS → Custom Records

---

## After Running the Setup Scripts

### 1. Verify Environment Variables Are Set

**Windows (Command Prompt):**
```cmd
echo %RESEND_API_KEY%
echo %FROM_EMAIL%
```

**Windows (PowerShell):**
```powershell
$env:RESEND_API_KEY
$env:FROM_EMAIL
```

**Linux/Mac:**
```bash
echo $RESEND_API_KEY
echo $FROM_EMAIL
```

### 2. Verify .env File Was Created

```bash
cat backend/.env
```

You should see all configuration values, including:
```
RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
FROM_EMAIL=chat@taskflow.pt
```

### 3. Start the Backend

```bash
cd backend
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
 * Resend API key configured: ****...g7Da
 * Email sender: chat@taskflow.pt
```

### 4. Test Email Sending

**Option A: Using Postman**

Import `ChatApp_API_Passwordless.postman_collection.json` and run:
1. "1. Register (Passwordless)" - Uses your email
2. Check your email for 6-digit verification code
3. Run "2. Verify Email" with the code

**Option B: Using curl**

```bash
curl -X POST http://localhost:5000/api/auth/register-passwordless \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"youremail@example.com"}'
```

Check the email address you provided for the verification code.

---

## Troubleshooting

### Problem: "Email not sending"

**Check 1: API Key Set Correctly**
```bash
# Windows CMD
echo %RESEND_API_KEY%

# Windows PowerShell
$env:RESEND_API_KEY

# Linux/Mac
echo $RESEND_API_KEY
```

Should show: `re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da`

**Check 2: Domain Verified**

Go to https://resend.com/domains and verify `taskflow.pt` shows as "Verified"

**Check 3: Backend Logs**

Look for errors in backend console:
```
ERROR: Failed to send email: 403 Forbidden
```

This means domain not verified yet.

**Check 4: Test Email API Directly**

```bash
cd backend
python -c "
from services.email_service import EmailService
service = EmailService()
result = service.send_verification_email(
    'youremail@example.com',
    'testuser',
    '123456'
)
print(result)
"
```

### Problem: "Variables not persisting after closing terminal"

**Windows:**
- Did you choose "Y" when asked to set permanently?
- Run `setx` commands manually:
  ```cmd
  setx RESEND_API_KEY "re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da"
  setx FROM_EMAIL "chat@taskflow.pt"
  ```
- Restart Command Prompt/PowerShell after setting

**Linux/Mac:**
- Did the script add to your `.bashrc` or `.zshrc`?
  ```bash
  grep RESEND_API_KEY ~/.bashrc ~/.zshrc
  ```
- If not found, add manually:
  ```bash
  echo 'export RESEND_API_KEY="re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da"' >> ~/.bashrc
  echo 'export FROM_EMAIL="chat@taskflow.pt"' >> ~/.bashrc
  source ~/.bashrc
  ```

### Problem: "Permission denied" on Linux/Mac

```bash
chmod +x setup-env.sh
./setup-env.sh
```

### Problem: "PowerShell execution policy" on Windows

```powershell
powershell -ExecutionPolicy Bypass -File setup-env.ps1
```

Or permanently allow scripts:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Manual Setup (Without Scripts)

If you prefer to set up manually:

### Windows (Command Prompt)

```cmd
cd backend
(
echo RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
echo FROM_EMAIL=chat@taskflow.pt
echo APP_NAME=ChatHub
echo FRONTEND_URL=http://localhost:3000
echo DATABASE_URL=mongodb://localhost:27017/chatapp
echo CORS_ALLOW_ALL=true
echo TENOR_API_KEY=AIzaSyCiAjRAFCxxSqkRIgzhZSSaDWktv84ZxW4
) > .env
```

### Windows (PowerShell)

```powershell
cd backend
@"
RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
FROM_EMAIL=chat@taskflow.pt
APP_NAME=ChatHub
FRONTEND_URL=http://localhost:3000
DATABASE_URL=mongodb://localhost:27017/chatapp
CORS_ALLOW_ALL=true
TENOR_API_KEY=AIzaSyCiAjRAFCxxSqkRIgzhZSSaDWktv84ZxW4
"@ | Out-File -FilePath .env -Encoding UTF8
```

### Linux/Mac

```bash
cd backend
cat > .env << 'EOF'
RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
FROM_EMAIL=chat@taskflow.pt
APP_NAME=ChatHub
FRONTEND_URL=http://localhost:3000
DATABASE_URL=mongodb://localhost:27017/chatapp
CORS_ALLOW_ALL=true
TENOR_API_KEY=AIzaSyCiAjRAFCxxSqkRIgzhZSSaDWktv84ZxW4
EOF
```

---

## Security Best Practices

### ⚠️ Never Commit .env Files

The `.env` file contains your API key and should NEVER be committed to git.

It's already in `.gitignore`, but verify:

```bash
grep -q "^.env$" .gitignore && echo "✓ Safe" || echo "✗ Add .env to .gitignore!"
```

### ⚠️ Rotate API Keys Regularly

If you suspect your API key has been exposed:

1. Go to https://resend.com/api-keys
2. Delete the old key
3. Create a new key
4. Update your `.env` file
5. Restart your backend

### ⚠️ Use Different Keys for Production

- **Development**: Use the provided key for testing
- **Production**: Create a separate API key in Resend dashboard
- Set up environment-specific configuration

---

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RESEND_API_KEY` | Resend email API key | - | ✅ Yes |
| `FROM_EMAIL` | Sender email address | chat@taskflow.pt | ✅ Yes |
| `APP_NAME` | Application name | ChatHub | ✅ Yes |
| `FRONTEND_URL` | Frontend URL | http://localhost:3000 | ✅ Yes |
| `DATABASE_URL` | MongoDB connection string | mongodb://localhost:27017/chatapp | ✅ Yes |
| `CORS_ALLOW_ALL` | Enable CORS for dev | true | ✅ Yes |
| `TENOR_API_KEY` | Tenor GIF API key | - | ✅ Yes |
| `SECRET_KEY` | Flask secret key | - | ✅ Yes |
| `SESSION_TYPE` | Session storage type | filesystem | No |
| `REDIS_URL` | Redis connection string | redis://localhost:6379/0 | No |
| `LOG_LEVEL` | Logging level | INFO | No |
| `TOTP_ISSUER` | 2FA issuer name | ChatHub | No |

---

## Next Steps

After setting up your environment:

1. ✅ **Verify domain in Resend** (https://resend.com/domains)
2. ✅ **Test email sending** with Postman collection
3. ✅ **Start frontend development** (see passwordless auth docs)
4. ✅ **Deploy to production** (update environment variables in Azure)

For complete authentication documentation, see: [PASSWORDLESS_AUTH_SETUP.md](PASSWORDLESS_AUTH_SETUP.md)

---

**Last Updated**: 2025-11-11
**Domain**: taskflow.pt
**API Key**: re_cW2E...g7Da (keep secret!)
