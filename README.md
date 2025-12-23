# TopicsFlow - Reddit-Style Discussion Platform

A comprehensive Reddit-style discussion platform with authenticator-based authentication, real-time messaging, theme management, posts and comments system, chat rooms, moderation system, anonymous mode, and PWA capabilities.

## Features

### 🔐 Security & Authentication
- **Passwordless Authentication**: Users log in via email/username + 6-digit TOTP code.
- **TOTP-based 2FA**: Full compatibility with Google Authenticator, Microsoft Authenticator, and Authy.
- **Robust Account Recovery**: Multi-step recovery using email verification and original TOTP secrets.
- **Backup Codes**: 10 high-entropy emergency access codes provided during setup.
- **Secure Sessions**: Encrypted session storage in Redis (Azure/Docker) or filesystem (local) with proper cookie security (HttpOnly).
- **Intelligent Caching**: Redis-based caching system for database queries with automatic cache invalidation. Dramatically improves performance (50-90% faster response times) while ensuring data consistency.
- **Advanced Banning**: Global banning system targeting IP addresses, emails, and phone numbers.

### 💬 Real-time Communication
- **Hybrid Platform**: Seamless integration between Reddit-style forums and instant chat rooms.
- **WebSocket Foundation**: Built on Socket.IO for sub-100ms latency.
- **Presence System**: Real-time "online" status and typing indicators across the entire app.
- **Group Chat Rooms**: Unlimited rooms per Topic with customizable profile/background images.
- **Direct Messaging (DMs)**: Private 1-on-1 conversations with encryption-ready architecture.
- **Voice Communication (VOIP)**: Integrated voice rooms with participant lists and active speaker detection.
- **Media Engine**: Instant sharing of GIFs (Tenor), images, videos, and files with secure cloud storage.
- **Anonymous Mode**: Per-topic identity masking with custom aliases to encourage open discussion.

### 📝 Content Management (The "Publications" System)
- **Dynamic Topics**: Hierarchical community spaces for high-level categorization.
- **Publications (Posts)**: Reddit-style nested posts with rich text (Markdown) support.
- **Voting Mechanism**: Positive/Negative reputation system for quality control.
- **Threaded Comments**: Deeply nested conversations with @mentions and reply tracking.
- **Navigation Controls**: Advanced sorting (Hot, New, Top) and tag-based discovery.
- **Search Engine**: Rapid indexing of topics and posts for easy discovery.

### 🛡️ Moderation & Support
- **Admin Dashboard**: Centralized command center for platform-wide oversight.
- **Integrated Ticket System**: Direct communication channel between users and administrators for help requests.
- **Report Lifecycle**: Comprehensive reporting for users/messages/posts with automated context attachment.
- **Role-based Access Control (RBAC)**: Granular permissions system (Owner -> Moderator -> Member).
- **Content Filtering**: Integrated profanity filters and link sanitization.

### 🎨 Design & Accessibility
- **Responsive Architecture**: Pixel-perfect layouts for Mobile, Tablet, and Desktop.
- **Modern Theme Engine**: Dynamic Dark/Light mode switching with cohesive HSL color palettes.
- **Internationalization (i18n)**: Native-level support for English and Portuguese.
- **PWA Capabilities**: Installable web app with push notifications and offline caching.
- **Accessibility**: ARIA-compliant components and keyboard-friendly navigation.

## Technology Stack

### Backend
- **Flask** (Python web framework)
- **Flask-SocketIO** (real-time WebSocket communication)
- **MongoDB** (NoSQL database)
- **PyOTP** (TOTP authentication)
- **Redis** (session storage and intelligent database caching with automatic invalidation)

### Frontend
- **Next.js** with TypeScript
- **Socket.IO Client** (real-time communication)
- **Tailwind CSS** (styling with theme variables)
- **React Hot Toast** (notifications)
- **PWA** capabilities with service workers and native install prompts
- **Image Viewer Modal**: Full-screen image viewing with download controls
- **Enhanced Video Player**: Fullscreen support, download, and right-click context menu
- **Context Menus**: Right-click menus for posts, messages, chatrooms, and users

### Infrastructure
- **Docker** with multi-stage builds
- **Docker Compose** for orchestration
- **Nginx** reverse proxy (production)
- **Environment-based configuration**

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd RINTEP2
   ```

2. **Start the application**
   ```bash
   ./START.sh
   ```

   This will:
   - Check prerequisites
   - Set up environment variables
   - Create necessary directories
   - Start all services (MongoDB, Redis, Backend, Frontend)
   - Wait for services to be healthy

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - MongoDB: localhost:27017
   - Redis: localhost:6379

### Manual Setup (Alternative)

If you prefer to set up manually:

1. **Set up environment variables**
   ```bash
   # Backend
   cp backend/env.example backend/.env
   # Frontend
   cp frontend/env.local.example frontend/.env.local
   # Edit the copied files with your configuration
   ```

2. **Start services with Docker Compose**
   ```bash
   docker-compose up --build
   ```

3. **Or run locally for development**

   **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python app.py
   ```

   **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Configuration

### Environment Variables

The application uses environment variables for configuration. You can set them up automatically or manually.

#### Automatic Setup (Recommended)

**Windows:**
```cmd
setup-env.bat
```

**Linux/Mac:**
```bash
chmod +x setup-env.sh
./setup-env.sh
```

**PowerShell:**
```powershell
powershell -ExecutionPolicy Bypass -File setup-env.ps1
```

#### Manual Setup

Create a `.env` file in the `backend/` directory:

```env
# Database Configuration
DATABASE_URL=mongodb://localhost:27017/TopicsFlow
REDIS_URL=redis://localhost:6379/0

# Application Configuration
SECRET_KEY=your_super_secret_key_here
FRONTEND_URL=http://localhost:3000
TOTP_ISSUER=TopicsFlow
APP_NAME=TopicsFlow

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@topicsflow.me

# External Services
TENOR_API_KEY=your_tenor_api_key

# File Storage (Optional - for Azure deployments)
USE_AZURE_STORAGE=false
AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection_string
AZURE_STORAGE_CONTAINER=uploads
FILE_ENCRYPTION_KEY=your_file_encryption_key  # Optional, defaults to SECRET_KEY

# ImgBB (Optional - for large chatroom images)
USE_IMGBB=false
IMGBB_API_KEY=your_imgbb_api_key
IMGBB_EXPIRATION_SECONDS=600
IMGBB_MAX_BASE64_SIZE_BYTES=2097152

# CORS (Development)
CORS_ALLOW_ALL=true
```

#### Environment variables reference (Local + Azure)

You can use these example templates:
- `backend/env.example` → copy to `backend/.env`
- `frontend/env.local.example` → copy to `frontend/.env.local`

**Backend (local development)**

| Variable | Description | Required |
|----------|-------------|----------|
| `SECRET_KEY` | Flask secret key | ✅ Yes |
| `ENVIRONMENT` | `development`/`production` (affects cookie security) | Recommended |
| `DATABASE_URL` | MongoDB connection string | ✅ Yes |
| `DB_NAME` | MongoDB database name | Recommended |
| `REDIS_URL` | Redis connection string (sessions/rate limit) | Recommended |
| `FRONTEND_URL` | Frontend origin (CORS + passkeys) | ✅ Yes |
| `CORS_ALLOW_ALL` | Allow all origins in dev | Optional |
| `RESEND_API_KEY` | Resend email API key | ✅ Yes |
| `FROM_EMAIL` | Verified sender email | ✅ Yes |
| `APP_NAME` | App name used in emails | Recommended |
| `TENOR_API_KEY` | Tenor API key for GIF search | Optional |
| `TENOR_CLIENT_KEY` | Tenor client key (defaults to `topicsflow_app`) | Optional |
| `PASSKEY_RP_ID` | WebAuthn RP ID (defaults to `localhost`) | Optional |
| `LOG_LEVEL` | Logging level | Optional |

**Backend storage (attachments)**

| Variable | Description | Required |
|----------|-------------|----------|
| `USE_AZURE_STORAGE` | Use Azure Blob Storage for attachments | Optional |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Storage connection string | Required if `USE_AZURE_STORAGE=true` |
| `AZURE_STORAGE_CONTAINER` | Blob container name (use `uploads`) | Required if `USE_AZURE_STORAGE=true` |
| `API_BASE_URL` | Used to build attachment URLs | Recommended |
| `FILE_ENCRYPTION_KEY` | Optional encryption key for attachment URLs (defaults to `SECRET_KEY`) | Optional |

**Backend ImgBB (optional for large chatroom images)**

| Variable | Description | Required |
|----------|-------------|----------|
| `USE_IMGBB` | Enable ImgBB uploads for large images | Optional |
| `IMGBB_API_KEY` | ImgBB API key | Required if `USE_IMGBB=true` |
| `IMGBB_EXPIRATION_SECONDS` | Optional ImgBB expiration | Optional |
| `IMGBB_MAX_BASE64_SIZE_BYTES` | Threshold to upload to ImgBB | Optional |

**Backend (Azure/CosmosDB Mongo API)**

| Variable | Description | Required |
|----------|-------------|----------|
| `AZURE_COSMOS_CONNECTIONSTRING` | CosmosDB (Mongo API) connection string | ✅ Yes (Azure) |
| `AZURE_COSMOS_DATABASE` | Cosmos database name | ✅ Yes (Azure) |
| `COSMOS_DB_URI` / `COSMOS_DB_NAME` | Alternative Cosmos env names supported by config | Optional |
| `AZURE_DEPLOYMENT` | Set to `true` to force Azure mode | Optional |
| `FORCE_AZURE_MODE` / `FORCE_LOCAL_MODE` | Force environment detection | Optional |

**Backend (Redis - Azure/Docker only)**

| Variable | Description | Required |
|----------|-------------|----------|
| `AZURE_REDIS_CONNECTIONSTRING` | Azure Redis Cache connection string (format: `host:port,password=...,ssl=True`) | Optional (Azure only) |
| `REDIS_URL` | Redis connection string (format: `redis://password@host:port/0`) | Optional (Docker/Azure) |
| `REDIS_PASSWORD` | Redis password (used in Docker Compose) | Optional (Docker) |
| `SESSION_TYPE` | Session backend: `filesystem` (local) or `redis` (Docker/Azure) | Auto-detected |

**Note**: Redis is **automatically disabled** for local development (non-Docker). The application uses filesystem sessions and direct database queries when running locally without Docker.

**Frontend**

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend base URL | ✅ Yes |
| `NEXT_PUBLIC_APP_NAME` | App name | Optional |
| `NEXT_PUBLIC_TENOR_API_KEY` | Tenor API key (only if frontend uses it directly) | Optional |

### Email Service Setup (Resend)

1. Get your API key from [Resend Dashboard](https://resend.com/api-keys)
2. Verify your domain in [Resend Domains](https://resend.com/domains)
3. Add DNS records provided by Resend to your domain
4. Set `FROM_EMAIL` to use your verified domain

### Tenor API Setup

1. Go to [Tenor Developer Portal](https://tenor.com/developer/keyregistration)
2. Sign in with Google account
3. Create a new API key
4. Add `TENOR_API_KEY` to your `.env` file

### Passwordless Authentication

The application uses **passwordless authentication** with TOTP (Time-based One-Time Password):

- **No passwords** - Users authenticate with username/email + 6-digit authenticator code
- **Email verification** - Required during registration (6-digit codes)
- **TOTP 2FA** - Industry-standard authenticator apps (Google Authenticator, Authy, etc.)
- **Backup codes** - Emergency access codes for account recovery
- **Secure recovery** - Requires email verification + original TOTP secret

**User Registration Flow:**
1. Enter username and email
2. Verify email with 6-digit code
3. Setup authenticator app (scan QR code or manual entry)
4. Verify TOTP code
5. Save backup codes

**User Login Flow:**
1. Enter username/email
2. Enter 6-digit code from authenticator app

**Account Recovery:**
1. Enter email → receive verification code
2. Verify email code
3. Enter original TOTP secret (saved during registration)
4. Setup new authenticator
5. Get new backup codes

**⚠️ Important:** Users must save their TOTP secret during registration for account recovery!

### Caching System

TopicsFlow includes an intelligent Redis-based caching system that dramatically improves performance:

**Features:**
- **Automatic Caching**: All database queries are automatically cached with appropriate TTLs
  - Static data (users, topics): 1 hour cache
  - Dynamic data (posts, comments, messages): 5 minutes cache
- **Automatic Invalidation**: Cache is automatically invalidated when data is updated, ensuring consistency
- **Graceful Fallback**: If Redis is unavailable, the application automatically falls back to direct database queries
- **Zero Configuration**: Works automatically in Docker/Azure deployments with Redis

**Local Development:**
- Redis cache is **disabled** by default on local machines
- Uses filesystem sessions and direct database queries
- No Redis installation required for local development

**Docker/Azure Deployments:**
- Redis is automatically used for both sessions and caching
- Provides 50-90% faster response times for cached queries
- Automatic cache invalidation ensures data consistency
- **Docker**: Redis is configured with password authentication (matches Azure approach)
- **Azure**: Uses Azure Redis Cache with SSL and connection string format (`host:port,password=...,ssl=True`)

**Cache Invalidation Strategy:**
- Direct updates invalidate the entity and related entities
- Cascading invalidation ensures all dependent data is refreshed
- Pattern-based invalidation for list queries

### Production Deployment

For production deployment:

1. **Update environment variables** with secure values
2. **Set up SSL certificates** for HTTPS
3. **Use production Docker Compose file**:
   ```bash
   ./START.sh prod
   ```
4. **Configure Nginx** for reverse proxy and SSL termination

See [Azure Deployment](#azure-deployment) section for cloud deployment options.

## API Documentation

### Authentication Endpoints

#### Passwordless Registration (Step 1: Start Registration)
```http
POST /api/auth/register-passwordless
Content-Type: application/json

{
  "username": "username",
  "email": "user@example.com"
}

Response 201:
{
  "success": true,
  "user_id": "507f1f77bcf86cd799439011",
  "message": "Verification code sent to your email"
}
```

#### Verify Email (Step 2)
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
  "totp_qr_data": "otpauth://totp/TopicsFlow:username?secret=...",
  "totp_secret": "JBSWY3DPEHPK3PXP",
  "user_id": "507f1f77bcf86cd799439011"
}
```

#### Complete TOTP Setup (Step 3)
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
  "backup_codes": ["12345678", "23456789", ...]
}
```

#### Passwordless Login
```http
POST /api/auth/login-passwordless
Content-Type: application/json

{
  "identifier": "username",  // username or email
  "totp_code": "123456"
}

Response 200:
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "username",
    "email": "user@example.com"
  }
}
```

#### Account Recovery
```http
POST /api/auth/recovery/initiate-passwordless
Content-Type: application/json

{
  "email": "user@example.com"
}

POST /api/auth/recovery/verify-email-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}

POST /api/auth/recovery/reset-totp
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011",
  "original_secret": "JBSWY3DPEHPK3PXP"  // Saved during registration
}
```

### Topic Endpoints

#### Get Topics
```http
GET /api/topics?sort_by=last_activity&limit=20&offset=0&tags=chat,gaming&search=gaming
```

#### Create Topic
```http
POST /api/topics
Content-Type: application/json
Authorization: Session cookie

{
  "title": "Topic Title",
  "description": "Topic description",
  "tags": ["chat", "gaming"],
  "allow_anonymous": true,
  "require_approval": false
}
```

### Message Endpoints

#### Get Topic Messages
```http
GET /api/messages/topic/{topic_id}?limit=50&before_message_id={message_id}
```

#### Send Message
```http
POST /api/messages/topic/{topic_id}
Content-Type: application/json
Authorization: Session cookie

{
  "content": "Hello, world!",
  "message_type": "text",
  "use_anonymous": false,
  "gif_url": "https://example.com/gif.gif"
}
```

## Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String (unique, validated),
  email: String (unique),
  phone: String (optional, for recovery),
  password_hash: String,
  totp_secret: String (encrypted),
  totp_enabled: Boolean,
  security_questions: [Array],
  is_banned: Boolean,
  ban_reason: String,
  ban_expiry: Date,
  ip_addresses: [String],
  created_at: Date,
  last_login: Date,
  preferences: {
    theme: String ('dark' | 'light'),
    language: String ('en' | 'pt'),
    anonymous_mode: Boolean
  }
}
```

### Topics Collection
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  owner_id: ObjectId,
  moderators: [{
    user_id: ObjectId,
    added_by: ObjectId,
    added_at: Date,
    permissions: [String]
  }],
  tags: [String],
  member_count: Number,
  is_public: Boolean,
  created_at: Date,
  last_activity: Date,
  settings: {
    allow_anonymous: Boolean,
    require_approval: Boolean
  }
}
```

### Messages Collection
```javascript
{
  _id: ObjectId,
  topic_id: ObjectId,
  user_id: ObjectId,
  content: String,
  topic_id: ObjectId,
  chat_room_id: ObjectId,  // For chat room messages
  user_id: ObjectId,
  content: String,
  message_type: String ('text' | 'emoji' | 'gif' | 'image' | 'video' | 'file' | 'system'),
  anonymous_identity: String,
  gif_url: String,
  attachments: [{  // File references (not base64 data)
    type: String,
    file_id: String,
    url: String,
    filename: String,
    size: Number,
    mime_type: String
  }],
  is_deleted: Boolean,
  deleted_by: ObjectId,
  deleted_at: Date,
  deletion_reason: String,  // For owner deletions
  reports: [{
    reported_by: ObjectId,
    reason: String,
    created_at: Date
  }],
  created_at: Date,
  updated_at: Date
}
```

### Chat Rooms Collection
```javascript
{
  _id: ObjectId,
  topic_id: ObjectId,
  name: String,
  description: String,
  owner_id: ObjectId,
  moderators: [ObjectId],
  members: [ObjectId],
  picture: String,  // Base64 profile picture
  background_picture: String,  // Base64 background image
  is_public: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### Private Messages Collection
```javascript
{
  _id: ObjectId,
  from_user_id: ObjectId,
  to_user_id: ObjectId,
  content: String,
  message_type: String,
  gif_url: String,
  deleted_for_user_ids: [ObjectId],  // Soft delete per user
  is_read: Boolean,
  read_at: Date,
  created_at: Date
}
```

### Reports Collection
```javascript
{
  _id: ObjectId,
  reporter_id: ObjectId,
  reported_user_id: ObjectId,
  content_id: String,  // Message, post, comment, or chatroom ID
  content_type: String,  // 'user' | 'message' | 'post' | 'comment' | 'chatroom' | 'chatroom_background' | 'chatroom_picture'
  reason: String,
  description: String,
  owner_id: ObjectId,  // For chatroom/content reports
  owner_username: String,
  moderators: [{id: ObjectId, username: String}],  // For admin analysis
  status: String,
  created_at: Date
}
```

## Development

### Local Development Setup

1. **Backend Development**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```

2. **Frontend Development**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database Setup**
   ```bash
   # Start MongoDB
   docker run -d --name mongodb -p 27017:27017 mongo:7.0

   # Start Redis
   docker run -d --name redis -p 6379:6379 redis:7.2-alpine
   ```

### Testing

#### Quick Testing Guide

```bash
# 1. Migrate database
python migrate_database.py migrate

# 2. Make admin user
python make_admin.py <username>

# 3. Start backend
cd backend && python app.py

# 4. Start frontend
cd frontend && npm run dev

# 5. Access app
http://localhost:3000
```

#### Test Scenarios

1. **Admin Controls**: Login as admin, check for shield icon (🛡️) in top bar
2. **Clickable Usernames**: Click username in chat → user banner appears
3. **Right-Click Menu**: Right-click username → context menu with options
4. **Report User**: Right-click → Report User → fill form → submit
5. **Ticket Creation**: Profile menu → Open Ticket → create ticket
6. **Anonymous Mode**: Enable "Use Anonymous" toggle in chat

#### Backend API Testing

**Using Postman:**
1. Import `tests/TopicsFlow_API.postman_collection.json`
2. Import environment file from `tests/postman/environments/`
3. Run collection tests

**Using Newman (CLI):**
```bash
npm install -g newman newman-reporter-html
newman run tests/postman/TopicsFlow_Backend_API.postman_collection.json \
  -e tests/postman/environments/Local.postman_environment.json \
  -r html --reporter-html-export tests/reports/report.html
```

**WebSocket Testing:**
- Use browser DevTools console
- See `tests/postman/TopicsFlow_WebSocket_Tests.md` for detailed instructions

For comprehensive testing documentation, see:
- `TESTING_GUIDE.md` - Quick testing scenarios
- `TEST_PLAN.md` - Comprehensive test plan
- `tests/TESTING_GUIDE.md` - Backend API testing guide
- `tests/TEST_TROUBLESHOOTING.md` - Test troubleshooting

### Code Quality

```bash
# Backend linting
cd backend
flake8 .
black .

# Frontend linting
cd frontend
npm run lint
npm run type-check
```

## Security Considerations

- **TOTP Secrets**: Encrypted at rest using AES-256
- **Passwords**: Hashed with bcrypt
- **Sessions**: Secure session management with HTTP-only cookies
- **Rate Limiting**: Implemented on all sensitive endpoints
- **Input Validation**: Comprehensive validation and sanitization
- **HTTPS**: Enforced in production
- **CORS**: Properly configured for frontend domain
- **Content Security Policy**: Headers implemented for XSS prevention

## Monitoring & Logging

### Application Logs
```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Health Checks
- Backend: `GET /health`
- Frontend: HTTP status checks
- Database: Connection health monitoring

## Azure Deployment

### Quick Start (5 minutes)

```bash
# 1. Install Azure CLI
# Linux/Mac: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
# Windows: Download from https://aka.ms/installazurecliwindows

# 2. Login to Azure
az login

# 3. Configure variables
cp .env.azure.example .env.azure
# Edit .env.azure with your values

# 4. Deploy
export $(cat .env.azure | xargs)
./azure-deploy.sh
```

### Architecture

- **Backend**: Flask + SocketIO + Static Frontend (served by Flask)
- **Database**: Azure CosmosDB (MongoDB API)
- **Cache**: Azure Cache for Redis (optional)
- **Deployment**: Azure Container Apps
- **SSL**: Automatic HTTPS

### Environment Detection

The application automatically detects Azure environment via:
- `WEBSITE_INSTANCE_ID`
- `AZURE_COSMOS_CONNECTIONSTRING`

When detected, it automatically:
- Uses CosmosDB instead of MongoDB
- Configures SSL connections
- Disables `retryWrites` (not supported by CosmosDB)
- Serves static frontend

### Required Azure Resources

- Azure Container Registry (ACR)
- Azure CosmosDB (MongoDB API)
- Azure Container Apps Environment
- Azure Container App

### Cost Estimate

- Container Apps: ~$40/month
- CosmosDB: ~$24/month
- Redis Cache: ~$16/month (optional)
- Container Registry: ~$5/month
- **Total: ~$85/month** (or ~$69 without Redis)

### CI/CD with GitHub Actions

1. Configure GitHub Secrets:
   - `AZURE_CREDENTIALS` - Service Principal JSON
   - `AZURE_CONTAINER_REGISTRY` - ACR name
   - `AZURE_RESOURCE_GROUP` - Resource group name
   - `AZURE_APP_NAME` - Container App name
   - `ACR_USERNAME` - ACR username
   - `ACR_PASSWORD` - ACR password

2. Push to trigger deployment:
   ```bash
   git push origin main
   ```

See `GITHUB_ACTIONS_SETUP.md` for detailed CI/CD setup instructions.

For complete Azure deployment documentation, see:
- `AZURE_DEPLOYMENT.md` - Comprehensive deployment guide
- `AZURE_QUICKSTART.md` - Quick start guide

## Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   # Check if ports are available
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <number> /F
   
   # Linux/Mac
   lsof -i :3000
   lsof -i :5000
   lsof -i :27017
   lsof -i :6379

   # Clean and restart
   docker-compose down -v
   docker system prune -f
   ./START.sh
   ```

2. **Database connection issues**
   ```bash
   # Check MongoDB logs
   docker-compose logs mongodb

   # Connect to MongoDB directly
   docker-compose exec mongodb mongosh
   ```

3. **TOTP authentication issues**
   - Ensure server time is synchronized
   - Check TOTP secret encryption
   - Verify authenticator app time sync
   - Codes expire every 30 seconds - use current code

4. **Frontend build issues**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

5. **Email not sending**
   - Verify Resend API key is set: `echo $RESEND_API_KEY`
   - Check domain is verified in Resend dashboard
   - Verify `FROM_EMAIL` uses verified domain
   - Check backend logs for errors

6. **bcrypt module not found (Windows)**
   ```bash
   # Solution 1: Reinstall bcrypt
   pip uninstall -y bcrypt
   pip install --only-binary :all: bcrypt==4.1.0
   
   # Solution 2: Install Visual Studio Build Tools
   # Download from https://visualstudio.microsoft.com/downloads/
   # Install "Desktop development with C++"
   
   # Solution 3: Use compatible version
   pip install bcrypt==4.0.1
   ```

7. **Port already in use (Windows)**
   ```cmd
   netstat -ano | findstr :5000
   taskkill /PID <number> /F
   ```

8. **MongoDB connection failed**
   ```bash
   # Check if MongoDB is running
   docker ps | findstr mongodb
   
   # Start MongoDB
   docker start mongodb-test
   
   # Or create new container
   docker run -d --name mongodb-test -p 27017:27017 \
     -e MONGO_INITDB_ROOT_USERNAME=admin \
     -e MONGO_INITDB_ROOT_PASSWORD=password123 \
     mongo:7.0
   ```

For Windows-specific troubleshooting, see `WINDOWS_TROUBLESHOOTING.md`.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test` and `python -m pytest`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow existing code patterns
- Write tests for new features
- Update documentation
- Use descriptive commit messages
- Keep PRs focused and manageable

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the API documentation

## Acknowledgments

- Built with Flask, Next.js, MongoDB, and Socket.IO
- Inspired by Reddit's community structure
- TOTP authentication standards
- Open source libraries and frameworks used