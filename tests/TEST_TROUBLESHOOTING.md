# Postman Test Troubleshooting Guide

## Common Issues and Solutions

### 1. Registration Failures (400 Bad Request)

**Issue**: Registration requests return 400 status code.

**Possible Causes**:
- Username/email already exists in database
- Password doesn't meet requirements (min 8 chars, special chars, etc.)
- Security questions format is incorrect
- Rate limiting (429 Too Many Requests)

**Solutions**:
1. **Clear existing test users** from database:
   ```bash
   # Connect to MongoDB
   mongo
   use chatapp
   db.users.deleteMany({username: {$in: ["testuser1", "testuser2"]}})
   ```

2. **Update environment variables** with unique values:
   - `username`: Use unique usernames (e.g., `testuser1_20251116`)
   - `email`: Use unique emails (e.g., `test1_20251116@example.com`)
   - `password`: Must be at least 8 characters with special chars (e.g., `Test123!@#`)

3. **Wait for rate limit** to reset (5 requests per minute for registration)

### 2. Authentication Failures (401 Unauthorized)

**Issue**: Most authenticated endpoints return 401.

**Possible Causes**:
- User registration failed, so `user_id` is not set
- TOTP verification not completed
- Session cookie not set properly
- Login failed

**Solutions**:
1. **Complete TOTP Setup**:
   - After registration, you'll receive `totp_qr_data` and `backup_codes`
   - Use an authenticator app to scan the QR code
   - Complete the "1.3 Complete TOTP Setup" request with a valid TOTP code
   - Or use a backup code from `backup_codes` array

2. **Check Environment Variables**:
   - Ensure `user_id` is set after successful registration
   - Ensure `session_cookie` is set after successful login

3. **Manual Login**:
   - Use "1.3 Login Passwordless" request
   - Enter TOTP code from your authenticator app
   - Check that `session_cookie` is set in environment

### 3. Topic ID is Null (500 Internal Server Error)

**Issue**: Tests fail with `topic_id` being `null`.

**Possible Causes**:
- No topics exist in database
- Topic creation failed (auth issue)
- Environment variable not set properly

**Solutions**:
1. **Create a topic manually** via Postman:
   - Use "2.2 Create Topic" request
   - Ensure you're authenticated (session cookie set)
   - Check that `topic_id` is set in environment after creation

2. **Use existing topic**:
   - Run "2.1 Get All Topics" first
   - If topics exist, the test will automatically set `topic_id` from the first topic

### 4. ObjectId Serialization Errors (500 Internal Server Error)

**Issue**: Some endpoints return 500 with "Object of type ObjectId is not JSON serializable".

**Status**: This has been fixed in the backend code. If you still see this error:
1. Restart the backend server
2. Clear browser/Postman cache
3. Re-run the tests

### 5. Missing HTML Reporter

**Issue**: `newman: could not find "html" reporter`

**Solution**:
```bash
npm install -g newman-reporter-html
```

Or run tests without HTML reporter:
```bash
newman run Tests/postman/ChatHub_Backend_API.postman_collection.json -e Tests/postman/environments/Local.postman_environment.json
```

## Test Execution Order

Tests must be run in order because they depend on each other:

1. **1.1 Register User 1** - Creates first test user
2. **1.2 Register User 2** - Creates second test user (may fail if rate limited)
3. **1.3 Complete TOTP Setup** - Sets up TOTP for User 1 (REQUIRED)
4. **1.4 Login Passwordless** - Logs in User 1 (REQUIRED for all other tests)
5. **1.5 Get Current User** - Verifies authentication
6. **2.1 Get All Topics** - Gets existing topics (sets `topic_id` if available)
7. **2.2 Create Topic** - Creates a new topic (sets `topic_id`)
8. **2.3 Get Topic by ID** - Tests topic retrieval
9. **2.4 Join Topic** - Joins the topic
10. **3.x Messages** - Tests message functionality
11. **4.x Private Messages** - Tests private messaging
12. **5.x Users** - Tests user endpoints

## Manual Test Steps

If automated tests fail, follow these manual steps:

### Step 1: Register User
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "testuser1",
  "email": "test1@example.com",
  "password": "Test123!@#",
  "security_questions": [
    {"question": "What is your favorite color?", "answer": "Blue"},
    {"question": "What is your pet's name?", "answer": "Max"}
  ],
  "phone_number": "+1234567890"
}
```

**Response**: You'll get `user_id`, `totp_qr_data`, and `backup_codes`.

### Step 2: Complete TOTP Setup
1. Scan the QR code from `totp_qr_data` with an authenticator app
2. Get the 6-digit code from the app
3. Use "1.3 Complete TOTP Setup" request with the code

### Step 3: Login
```http
POST http://localhost:5000/api/auth/login-passwordless
Content-Type: application/json

{
  "identifier": "testuser1",
  "totp_code": "123456"
}
```

**Note**: Copy the `Set-Cookie` header value and set it as `session_cookie` in Postman environment.

### Step 4: Set Session Cookie
In Postman:
1. Go to Environment variables
2. Set `session_cookie` to the value from `Set-Cookie` header
3. Or use Postman's automatic cookie handling

## Environment Variables Checklist

Before running tests, ensure these are set:

- [ ] `base_url`: `http://localhost:5000`
- [ ] `username`: Unique username (e.g., `testuser1_20251116`)
- [ ] `username_2`: Unique username (e.g., `testuser2_20251116`)
- [ ] `email`: Unique email (e.g., `test1_20251116@example.com`)
- [ ] `email_2`: Unique email (e.g., `test2_20251116@example.com`)
- [ ] `password`: Valid password (min 8 chars, special chars)
- [ ] `user_id`: Set after User 1 registration
- [ ] `user_id_2`: Set after User 2 registration
- [ ] `topic_id`: Set after topic creation or from existing topics
- [ ] `session_cookie`: Set after login

## Debugging Tips

1. **Check Backend Logs**: Look for error messages in the backend console
2. **Check Postman Console**: View → Show Postman Console (Cmd/Ctrl + Alt + C)
3. **Verify Environment Variables**: Check that variables are set correctly
4. **Test Individual Requests**: Run requests one by one to isolate issues
5. **Check Response Bodies**: Read error messages in response bodies

## Expected Test Results

After fixing all issues, you should see:
- ✅ All authentication tests passing
- ✅ All topic tests passing (if topics exist or are created)
- ✅ All message tests passing (if authenticated and topic exists)
- ✅ All private message tests passing (if both users are registered and authenticated)
- ✅ All user tests passing (if authenticated)

## Still Having Issues?

1. **Clear Database**: Remove all test data and start fresh
2. **Restart Backend**: Ensure latest code is running
3. **Check Backend Logs**: Look for specific error messages
4. **Verify MongoDB Connection**: Ensure MongoDB is running and accessible
5. **Check CORS Settings**: Ensure frontend URL is allowed in backend CORS config

