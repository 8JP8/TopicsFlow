# ChatHub Backend Testing Guide

This guide provides comprehensive instructions for testing the ChatHub backend API and WebSocket functionality.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Running REST API Tests](#running-rest-api-tests)
4. [Running WebSocket Tests](#running-websocket-tests)
5. [Test Scenarios](#test-scenarios)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

- **Postman** (v10.0.0 or later) - For REST API testing
- **Node.js** (v16 or later) - For running test scripts
- **MongoDB** - Running and accessible
- **Backend Server** - Running on `http://localhost:5000`
- **Authenticator App** - For TOTP codes (Google Authenticator, Authy, etc.)

## Environment Setup

### 1. Import Postman Collection and Environment

1. Open Postman
2. Click **Import** button
3. Import the following files:
   - `tests/postman/ChatHub_Backend_API.postman_collection.json`
   - `tests/postman/environments/Local.postman_environment.json`
4. Select the **ChatHub Local Test Environment** from the environment dropdown

### 2. Configure Environment Variables

The environment file includes default values. Update if needed:

- `base_url`: `http://localhost:5000`
- `username`: Test user 1 username
- `username_2`: Test user 2 username
- `email`: Test user 1 email
- `email_2`: Test user 2 email
- `password`: Test password (must meet requirements)

### 3. Start Backend Server

```bash
cd backend
python app.py
```

Or using the run script:
```bash
# Windows
run-local.bat

# Linux/Mac
./run-local.sh
```

## Running REST API Tests

### Automated Testing with Newman

Newman is Postman's CLI tool for running collections.

#### Install Newman

```bash
npm install -g newman
```

#### Run Collection

```bash
# Basic run
newman run tests/postman/ChatHub_Backend_API.postman_collection.json -e tests/postman/environments/Local.postman_environment.json

# With HTML report
newman run tests/postman/ChatHub_Backend_API.postman_collection.json \
  -e tests/postman/environments/Local.postman_environment.json \
  -r html \
  --reporter-html-export tests/reports/report.html

# With detailed output
newman run tests/postman/ChatHub_Backend_API.postman_collection.json \
  -e tests/postman/environments/Local.postman_environment.json \
  --verbose
```

### Manual Testing in Postman

1. **Run Tests in Order**:
   - Tests are organized in folders (1. Authentication, 2. Topics, etc.)
   - Run tests sequentially as they depend on previous results
   - Use "Run Collection" to execute all tests

2. **Test Execution Order**:
   ```
   1. Authentication
      - Register User 1
      - Register User 2
      - Login Passwordless (User 1)
      - Get Current User
   
   2. Topics
      - Get All Topics
      - Create Topic
      - Get Topic by ID
      - Join Topic
   
   3. Messages
      - Get Topic Messages
      - Send Message to Topic
      - Get Message by ID
   
   4. Private Messages
      - Get Private Conversations
      - Send Private Message
      - Send Self Message
      - Get Conversation with User
      - Get Self Conversation
   
   5. Users
      - Get User Profile
      - Search Users
   ```

3. **TOTP Code Setup**:
   - After registering users, you need to complete TOTP setup
   - Use an authenticator app to scan QR code or enter secret
   - Get 6-digit TOTP code before running login tests
   - Update `totp_code` environment variable or enter manually

## Running WebSocket Tests

WebSocket tests require browser DevTools or a Socket.IO client. See `tests/postman/ChatHub_WebSocket_Tests.md` for detailed instructions.

### Quick Browser Test

1. Open browser DevTools (F12)
2. Navigate to `http://localhost:3000` (frontend)
3. Open Console tab
4. Use Socket.IO client code from WebSocket tests document

### Node.js Test Script

Create a test file `tests/websocket_test.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  withCredentials: true
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  // Test join topic
  socket.emit('join_topic', { topic_id: 'your_topic_id' });
});

socket.on('topic_joined', (data) => {
  console.log('Joined topic:', data);
});

socket.on('error', (error) => {
  console.error('Error:', error);
});
```

Run with:
```bash
node tests/websocket_test.js
```

## Test Scenarios

### Scenario 1: Complete Message Flow

1. **Register two users**
2. **Create a topic**
3. **Both users join topic**
4. **User 1 sends message with mention**: `"Hello @username_2!"`
5. **Verify**:
   - Message appears in topic for both users
   - User 2 receives `user_mentioned` event
   - User 2 sees notification in NotificationCenter
   - Toast notification appears for User 2

### Scenario 2: Private Message Flow

1. **User 1 sends private message to User 2**
2. **Verify**:
   - Message saved to database
   - User 1 receives `private_message_sent` confirmation
   - User 2 receives `new_private_message` event (if online)
   - User 2 sees notification and toast

### Scenario 3: Self-Message Flow

1. **User 1 sends message to themselves**
2. **Verify**:
   - Message saved to database
   - Message appears in "received messages" (WhatsApp-like)
   - Both `private_message_sent` and `new_private_message` events received

### Scenario 4: Real-time Updates

1. **User 1 and User 2 in same topic**
2. **User 1 sends message**
3. **Verify**:
   - User 2 receives `new_message` event immediately
   - Message appears in User 2's UI without refresh
   - No polling or manual refresh needed

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem**: `401 Unauthorized` responses

**Solutions**:
- Ensure you've logged in successfully
- Check that session cookie is being sent
- Verify TOTP code is correct
- Try logging in again

#### 2. TOTP Code Issues

**Problem**: TOTP code not working

**Solutions**:
- Ensure time is synchronized on your device
- Check that TOTP setup was completed
- Verify you're using the correct authenticator app
- Try generating a new code (codes expire every 30 seconds)

#### 3. WebSocket Connection Failed

**Problem**: Cannot connect to WebSocket

**Solutions**:
- Verify backend server is running
- Check CORS settings in backend
- Ensure session cookie is valid
- Try using `http://` instead of `ws://` for Socket.IO

#### 4. Messages Not Appearing

**Problem**: Messages sent but not visible

**Solutions**:
- Check backend logs for errors
- Verify user has joined the topic
- Check database for message insertion
- Verify WebSocket events are being emitted
- Check browser console for frontend errors

#### 5. Mentions Not Working

**Problem**: @mentions not triggering notifications

**Solutions**:
- Verify mentioned user is in the topic
- Check username/anonymous name spelling (case-insensitive)
- Check backend logs for mention processing
- Verify user's personal room is joined on connect

### Debugging Tips

1. **Backend Logs**: Check console output for `[MESSAGE_SEND]`, `[PRIVATE_MSG]` logs
2. **Frontend Logs**: Check browser console for `[SocketContext]`, `[ChatContainer]` logs
3. **Database**: Verify messages are being saved in MongoDB
4. **Network Tab**: Check WebSocket frames in browser DevTools

### Test Data Cleanup

After testing, you may want to clean up test data:

```javascript
// MongoDB cleanup script
db.users.deleteMany({ username: /^test/ });
db.topics.deleteMany({ title: /Test Topic/ });
db.messages.deleteMany({ content: /Test message/ });
db.private_messages.deleteMany({ content: /Test private/ });
```

## Test Execution Scripts

### Windows (`tests/run_tests.bat`)

```batch
@echo off
echo Running ChatHub Backend API Tests...
newman run tests/postman/ChatHub_Backend_API.postman_collection.json -e tests/postman/environments/Local.postman_environment.json -r html --reporter-html-export tests/reports/report.html
if %ERRORLEVEL% NEQ 0 (
    echo Tests failed!
    exit /b 1
)
echo Tests completed successfully!
```

### Linux/Mac (`tests/run_tests.sh`)

```bash
#!/bin/bash
echo "Running ChatHub Backend API Tests..."
newman run tests/postman/ChatHub_Backend_API.postman_collection.json \
  -e tests/postman/environments/Local.postman_environment.json \
  -r html \
  --reporter-html-export tests/reports/report.html

if [ $? -ne 0 ]; then
    echo "Tests failed!"
    exit 1
fi

echo "Tests completed successfully!"
```

Make executable:
```bash
chmod +x tests/run_tests.sh
```

## Expected Test Results

### Success Criteria

- ✅ All REST API endpoints return correct status codes
- ✅ Response schemas match expected structure
- ✅ WebSocket events are emitted correctly
- ✅ Messages are saved to database
- ✅ Real-time updates work without refresh
- ✅ Mentions trigger notifications
- ✅ Private messages deliver correctly
- ✅ Self-messages appear in received messages

### Performance Benchmarks

- API response time: < 500ms
- WebSocket message delivery: < 100ms
- Database query time: < 200ms

## Additional Resources

- [Postman Documentation](https://learning.postman.com/docs/)
- [Newman Documentation](https://learning.postman.com/docs/running-collections/using-newman-cli/command-line-integration-with-newman/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [MongoDB Documentation](https://docs.mongodb.com/)

