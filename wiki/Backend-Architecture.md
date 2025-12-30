# Backend Architecture

The TopicsFlow backend is a robust RESTful API built with Python and Flask, designed for scalability and real-time interaction.

## 🏗️ Core Components

### 1. Flask Application Factory
The application is initialized in `app.py` using the factory pattern (`create_app`). This approach facilitates testing and allows for multiple instances with different configurations.

- **Configuration**: Loaded from `config.py` based on `FLASK_ENV` (development, production, testing).
- **Database**: Connects to MongoDB (or Azure CosmosDB) using `pymongo`.
- **Extensions**: Initializes Flask-SocketIO, Flask-CORS, and Flask-Session.

### 2. Service Layer Pattern
Business logic is encapsulated in the `services/` directory, separating it from the HTTP transport layer (routes).

| Service | Description |
|---|---|
| `AuthService` | Handles user authentication, registration, and session management. |
| `EmailService` | Manages email notifications and verification (SendGrid/SMTP). |
| `FileStorage` | Abstraction for file uploads (Azure Blob Storage / Local). |
| `TenorService` | Integration with Tenor API for GIF search. |

### 3. Data Models (`models/`)
The application uses a custom Object-Document Mapper (ODM) pattern wrapping `pymongo` calls. Each model class (e.g., `User`, `Topic`) handles its own database interactions, validation, and schema enforcement.

### 4. Real-time Engine (Socket.IO)
Real-time features are powered by `Flask-SocketIO`. Event handlers are defined in `socketio_handlers.py`.

**Key Namespaces & Rooms:**
- `user_<user_id>`: Personal room for notifications and private messages.
- `topic_<topic_id>`: Room for active topic discussions.
- `chat_room_<room_id>`: Room for specific chat conversations.
- `voip_<call_id>`: Signaling room for WebRTC calls.

## 🔌 API Structure (`routes/`)

The API is organized into Blueprints, each responsible for a specific domain.

| Blueprint | Prefix | Description |
|---|---|---|
| `auth_bp` | `/api/auth` | Login, Register, Logout, Password Reset. |
| `topics_bp` | `/api/topics` | Create, list, join, and manage topics. |
| `posts_bp` | `/api/posts` | CRUD for topic posts (Reddit-style). |
| `messages_bp` | `/api/messages` | Message history and management. |
| `users_bp` | `/api/users` | User profile and settings. |
| `admin_bp` | `/api/admin` | Administrative tools and stats. |

## 🛡️ Security & Middleware

- **Authentication**: Custom session-based auth with `AuthService`.
- **Rate Limiting**: Implemented via `utils.rate_limits` to prevent abuse.
- **CORS**: Configured to allow specific origins (frontend, production domains).
- **Input Validation**: `utils.validators` sanitize user input.
- **Content Filtering**: `utils.content_filter` scans for inappropriate content.

## ⚡ Caching Strategy (Redis)

Redis is used for:
1. **Server-side Sessions**: Storing user session data (Flask-Session).
2. **Data Caching**: Caching expensive queries (e.g., user profiles, topic lists) using `utils.cache_decorator`.
3. **Pub/Sub**: (Implicitly via Socket.IO) Message broadcasting.

## 🔄 Request Lifecycle

1. **Request**: Incoming HTTP request hits Flask.
2. **Middleware**: CORS, Session checks.
3. **Route**: Dispatched to appropriate Blueprint.
4. **Service**: Route calls Service layer for logic.
5. **Model**: Service interacts with Model for data access.
6. **Database**: Model queries MongoDB.
7. **Response**: JSON response returned to client.

For WebSocket events, the lifecycle is similar but event-driven via `socketio_handlers.py`.
