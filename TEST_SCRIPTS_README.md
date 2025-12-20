# Test Scripts Documentation

## Overview

This project includes automated test scripts to clear test data and run Postman collection tests.

## Scripts

### 1. `clear_test_data.py`
Python script that clears test users and related data from MongoDB.

**Usage:**
```bash
python clear_test_data.py
```

**What it does:**
- Removes test users (`testuser1`, `testuser2`)
- Removes users with test email addresses
- Removes users matching test patterns (e.g., `testuser1_*`, `testuser2_*`)
- Optionally removes test messages and private messages (commented out by default)

### 2. `run_tests.bat` (Windows)
Batch script that automates the entire test process.

**Usage:**
```bash
run_tests.bat
```

**What it does:**
1. Clears test data from database using `clear_test_data.py`
2. Checks and installs Newman (Postman CLI) if needed
3. Checks and installs HTML reporter if needed
4. Runs Postman collection tests
5. Generates HTML test report
6. Opens the report in browser

### 3. `run_tests.sh` (Linux/Mac)
Shell script with the same functionality as the batch script.

**Usage:**
```bash
chmod +x run_tests.sh
./run_tests.sh
```

## Test Results

The test script will:
- ✅ Clear old test data automatically
- ✅ Install required dependencies
- ✅ Run all Postman collection tests
- ✅ Generate an HTML report in `Tests/reports/report.html`

## Expected Test Failures

Some tests will fail because they require:
1. **TOTP Setup**: After registration, users must complete TOTP setup using an authenticator app
2. **Authentication**: Users must login to get session cookies
3. **Test Data**: Some tests need topics/messages to exist

These are **expected failures** and indicate that:
- ✅ The test infrastructure is working
- ✅ The API endpoints are responding
- ⚠️ Manual steps are needed for full test coverage

## Manual Test Steps

For complete test coverage, follow these steps:

1. **Run the test script** to register users
2. **Complete TOTP setup**:
   - Get QR code from registration response
   - Scan with authenticator app (Google Authenticator, Authy, etc.)
   - Use the 6-digit code in "1.3 Complete TOTP Setup" request
3. **Login** using "1.3 Login Passwordless" request
4. **Re-run tests** or continue manually

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongod` or check your MongoDB service
- Check connection string in `.env` file or environment variables
- Default: `mongodb://localhost:27017/TopicsFlow`

### Newman Not Found
- The script will automatically install Newman
- If it fails, manually run: `npm install -g newman`

### HTML Reporter Not Found
- The script will automatically install the HTML reporter
- If it fails, manually run: `npm install -g newman-reporter-html`

### Test Failures
- Check `Tests/TEST_TROUBLESHOOTING.md` for detailed solutions
- Review backend logs for error messages
- Verify environment variables are set correctly

## Files Generated

- `Tests/reports/report.html` - HTML test report (opens automatically on Windows)

## Next Steps

1. Review test report to see which tests passed/failed
2. Complete TOTP setup for registered users
3. Login to get authentication cookies
4. Re-run specific test folders or individual requests
5. Check `Tests/TEST_TROUBLESHOOTING.md` for detailed guidance

