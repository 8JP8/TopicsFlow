# ChatHub WebSocket Tests

This document describes how to test WebSocket functionality using Socket.IO. Postman has limited WebSocket support, so these tests should be performed using:

1. **Browser DevTools** - Use the browser console to test Socket.IO connections
2. **Socket.IO Client** - Use a Node.js script or browser-based Socket.IO client
3. **Postman WebSocket** - Basic connection testing (limited)

## WebSocket Endpoint

- **URL**: `ws://localhost:5000/socket.io/?EIO=4&transport=websocket`
- **Protocol**: Socket.IO v4 (Engine.IO v4)

## Test Scenarios

### 1. Connection Test

**Event**: `connect`

**Expected Behavior**:
- Client connects successfully
- Server emits `connect` event
- Client receives connection confirmation

**Test Script** (Browser Console):
```javascript
const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  withCredentials: true
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

### 2. Join Topic Test

**Event**: `join_topic`

**Request**:
```json
{
  "topic_id": "topic_id_here"
}
```

**Expected Response**: `topic_joined` event with:
```json
{
  "topic_id": "topic_id_here",
  "topic_title": "Topic Title",
  "messages": [...]
}
```

**Test Script**:
```javascript
socket.emit('join_topic', { topic_id: 'your_topic_id' });

socket.on('topic_joined', (data) => {
  console.log('Joined topic:', data.topic_title);
  console.log('Messages:', data.messages);
});
```

### 3. Send Message Test

**Event**: `send_message`

**Request**:
```json
{
  "topic_id": "topic_id_here",
  "content": "Test message with @mention",
  "message_type": "text",
  "use_anonymous": false
}
```

**Expected Responses**:
1. `new_message` event - Message broadcast to topic room
2. `message_sent` event - Confirmation to sender
3. `user_mentioned` event (if mentions present) - Notification to mentioned users

**Test Script**:
```javascript
socket.emit('send_message', {
  topic_id: 'your_topic_id',
  content: 'Hello @username!',
  message_type: 'text',
  use_anonymous: false
});

socket.on('new_message', (data) => {
  console.log('New message received:', data);
});

socket.on('message_sent', (data) => {
  console.log('Message sent confirmation:', data.message_id);
});

socket.on('user_mentioned', (data) => {
  console.log('You were mentioned:', data);
});
```

### 4. Private Message Test

**Event**: `send_private_message`

**Request**:
```json
{
  "to_user_id": "user_id_here",
  "content": "Private message test",
  "message_type": "text"
}
```

**Expected Responses**:
1. `private_message_sent` event - Confirmation to sender
2. `new_private_message` event - Notification to receiver (if online)
3. `private_message_confirmed` event - Final confirmation

**Test Script**:
```javascript
socket.emit('send_private_message', {
  to_user_id: 'target_user_id',
  content: 'Private message',
  message_type: 'text'
});

socket.on('private_message_sent', (data) => {
  console.log('Private message sent:', data);
});

socket.on('new_private_message', (data) => {
  console.log('New private message:', data);
});
```

### 5. Self-Message Test

**Event**: `send_private_message` (to yourself)

**Request**:
```json
{
  "to_user_id": "your_user_id",
  "content": "Self-message test",
  "message_type": "text"
}
```

**Expected Behavior**:
- Message should be saved to database
- Both `private_message_sent` and `new_private_message` events should be emitted
- Message should appear in received messages (WhatsApp-like behavior)

### 6. Mention Test

**Event**: `send_message` (with @mention)

**Request**:
```json
{
  "topic_id": "topic_id_here",
  "content": "Hey @username, check this out!",
  "message_type": "text",
  "use_anonymous": false
}
```

**Expected Behavior**:
- Message is sent normally
- `user_mentioned` event is emitted to mentioned user's personal room
- Mentioned user receives notification in NotificationCenter
- Toast notification appears

**Test Script**:
```javascript
// As User 1 - Send message with mention
socket.emit('send_message', {
  topic_id: 'topic_id',
  content: 'Hey @testuser2, check this!',
  message_type: 'text'
});

// As User 2 - Listen for mention
socket.on('user_mentioned', (data) => {
  console.log('Mentioned in:', data.topic_title);
  console.log('By:', data.mentioned_by);
  console.log('Preview:', data.content_preview);
});
```

### 7. Typing Indicators Test

**Events**: `typing_start`, `typing_stop`

**Request**:
```json
{
  "topic_id": "topic_id_here"
}
```

**Expected Response**: `user_typing` / `user_stop_typing` events broadcast to topic room

**Test Script**:
```javascript
socket.emit('typing_start', { topic_id: 'topic_id' });
socket.on('user_typing', (data) => {
  console.log('User typing:', data.display_name);
});

socket.emit('typing_stop', { topic_id: 'topic_id' });
socket.on('user_stop_typing', (data) => {
  console.log('User stopped typing:', data.user_id);
});
```

### 8. Real-time Message Updates Test

**Scenario**: Two users in same topic

**Steps**:
1. User 1 joins topic
2. User 2 joins topic
3. User 1 sends message
4. User 2 should receive `new_message` event immediately

**Test Script** (User 2):
```javascript
socket.on('new_message', (data) => {
  console.log('Real-time message update:', data);
  // Message should appear in UI immediately
});
```

### 9. Disconnect Test

**Event**: `disconnect`

**Expected Behavior**:
- User is removed from `connected_users`
- User leaves all topic rooms
- Other users receive `user_offline` event
- Topic members receive `user_left_topic` event

## Error Handling Tests

### Test Invalid Topic ID
```javascript
socket.emit('send_message', {
  topic_id: 'invalid_id',
  content: 'Test'
});

socket.on('error', (data) => {
  console.log('Error received:', data.message);
});
```

### Test Unauthenticated Connection
- Try to connect without valid session
- Should fail gracefully

## Performance Tests

1. **Multiple Messages**: Send 100 messages rapidly, verify all are received
2. **Multiple Mentions**: Send message with 10 mentions, verify all users notified
3. **Concurrent Connections**: 50+ users in same topic, verify message delivery

## Notes

- All WebSocket events require authentication (session cookie)
- Messages are validated before being saved
- Mentions are case-insensitive
- Self-messages are supported and appear in received messages
- Real-time updates work via Socket.IO rooms

