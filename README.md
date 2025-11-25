# TopicsFlow - Reddit-Style Discussion Platform

A comprehensive Reddit-style discussion platform with authenticator-based authentication, real-time messaging, theme management, posts and comments system, chat rooms, moderation system, anonymous mode, and PWA capabilities.

## Features

### 🔐 Security & Authentication
- **TOTP-based 2FA** with Google/Microsoft Authenticator compatibility
- **Account Recovery** via SMS verification and security questions
- **Backup Codes** for account access when authenticator is unavailable
- **Secure Session Management** with proper encryption
- **Multi-identifier Banning** (IP, email, phone) for moderators

### 💬 Real-time Chat
- **WebSocket Communication** via Socket.IO
- **Topic-based Chat Rooms** with unlimited participants
- **Anonymous Mode** with per-topic fake usernames
- **Private Messaging** between users
- **Message Types**: Text, emojis, GIFs (Tenor integration)
- **Typing Indicators** and user presence
- **Content Filtering**: Links blocked, profanity filtered

### 📝 Topic Management
- **Public Topics** that anyone can join
- **Topic Creation** with titles, descriptions, and tags
- **Topic Sorting**: By activity, member count, or creation date
- **Search & Filtering**: By name, tags, or content
- **Topic Ownership**: Creator has full control and moderation powers

### 🛡️ Moderation System
- **Multi-level Permissions**: Owner (3) → Moderator (2) → User (1)
- **Message Reporting** with context (previous 3-4 messages)
- **Moderation Actions**: Delete messages, ban users, timeout users
- **Ban Management**: Temporary and permanent bans
- **Report Review Interface** for moderators and owners

### 🎨 User Experience
- **Dark/Light Themes** with smooth transitions
- **Internationalization**: English and Portuguese support
- **PWA Support**: Install on any device with browser prompts
- **Responsive Design**: Mobile, tablet, and desktop optimized
- **Real-time Notifications**: For messages, mentions, and reports

## Technology Stack

### Backend
- **Flask** (Python web framework)
- **Flask-SocketIO** (real-time WebSocket communication)
- **MongoDB** (NoSQL database)
- **PyOTP** (TOTP authentication)
- **Redis** (session storage and caching)

### Frontend
- **Next.js** with TypeScript
- **Socket.IO Client** (real-time communication)
- **Tailwind CSS** (styling)
- **React Hot Toast** (notifications)
- **PWA** capabilities with service workers

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
   cp .env.example .env
   # Edit .env with your configuration
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

Create a `.env` file in the root directory:

```env
# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=secure_password_here
REDIS_PASSWORD=secure_redis_password_here

# Application Configuration
FLASK_SECRET_KEY=your_super_secret_key_here
FRONTEND_URL=http://localhost:3000
TOTP_ISSUER=TopicsFlow

# External Services (Optional)
SMS_SERVICE_API_KEY=your_twilio_api_key
EMAIL_SERVICE_API_KEY=your_sendgrid_api_key
TENOR_API_KEY=your_tenor_api_key
```

### Production Deployment

For production deployment:

1. **Update environment variables** with secure values
2. **Set up SSL certificates** for HTTPS
3. **Use production Docker Compose file**:
   ```bash
   ./START.sh prod
   ```
4. **Configure Nginx** for reverse proxy and SSL termination

## API Documentation

### Authentication Endpoints

#### Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "username",
  "email": "user@example.com",
  "password": "secure_password",
  "phone": "+1234567890",
  "security_questions": [
    {
      "question": "What was your first pet's name?",
      "answer": "fluffy"
    }
  ]
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "username",
  "password": "password",
  "totp_code": "123456"
}
```

#### Login with Backup Code
```http
POST /api/auth/login-backup
Content-Type: application/json

{
  "username": "username",
  "password": "password",
  "backup_code": "12345678"
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
  message_type: String ('text' | 'emoji' | 'gif' | 'system'),
  anonymous_identity: String,
  gif_url: String,
  is_deleted: Boolean,
  deleted_by: ObjectId,
  deleted_at: Date,
  reports: [{
    reported_by: ObjectId,
    reason: String,
    created_at: Date
  }],
  created_at: Date,
  updated_at: Date
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

```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd frontend
npm run test
```

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

## Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   # Check if ports are available
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

4. **Frontend build issues**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

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