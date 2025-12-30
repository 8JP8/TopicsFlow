# API Reference

The TopicsFlow API follows REST principles for HTTP endpoints and uses Socket.IO for real-time events.

## 🌐 HTTP Endpoints

All API routes are prefixed with `/api`.

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Create a new user account. |
| `POST` | `/login` | Authenticate user (Password or TOTP). |
| `POST` | `/login/passwordless` | Login without password (via email link/code). |
| `POST` | `/logout` | End the current session. |
| `GET` | `/me` | Get current user profile. |

### Topics (`/api/topics`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List public topics (paginated). |
| `POST` | `/` | Create a new topic. |
| `GET` | `/<id>` | Get topic details. |
| `PUT` | `/<id>` | Update topic settings (Owner only). |
| `POST` | `/<id>/join` | Join a topic. |

### Chat Rooms (`/api/chat-rooms`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/topic/<topic_id>` | List chat rooms in a topic. |
| `POST` | `/` | Create a new chat room. |
| `GET` | `/<id>` | Get chat room details. |
| `POST` | `/<id>/messages` | Send a message to the room. |

### Posts (`/api/posts`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/topic/<topic_id>` | List posts in a topic. |
| `POST` | `/` | Create a new post. |
| `GET` | `/<id>` | Get post details. |
| `POST` | `/<id>/vote` | Upvote/Downvote a post. |

### Messages (`/api/messages`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/topic/<topic_id>` | Get message history for a topic (Legacy). |
| `GET` | `/room/<room_id>` | Get message history for a chat room. |
| `DELETE` | `/<id>` | Delete a message. |

## 🔌 Socket.IO Events

### Client -> Server

| Event | Data | Description |
|---|---|---|
| `join_topic` | `{ topic_id }` | Join a topic's real-time channel. |
| `leave_topic` | `{ topic_id }` | Leave a topic's channel. |
| `send_message` | `{ topic_id, content }` | Send a message to a topic. |
| `typing_start` | `{ topic_id }` | Indicate user is typing. |
| `join_chat_room` | `{ room_id }` | Join a specific chat room channel. |
| `voip_create_call`| `{ room_id }` | Initiate a WebRTC call. |

### Server -> Client

| Event | Data | Description |
|---|---|---|
| `new_message` | `{ message_obj }` | A new message was posted in the room. |
| `user_joined_topic` | `{ user_id, username }` | A user joined the topic. |
| `user_typing` | `{ username }` | A user is typing. |
| `new_notification` | `{ type, message }` | Real-time notification for current user. |
| `online_count_update`| `{ count }` | Update total online user count. |

## 📦 Data Formats

**User Object**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "username": "jdoe",
  "profile_picture": "url_to_image",
  "is_online": true
}
```

**Message Object**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "content": "Hello world!",
  "user_id": "507f1f77bcf86cd799439011",
  "created_at": "2023-10-01T12:00:00Z",
  "is_anonymous": false
}
```
