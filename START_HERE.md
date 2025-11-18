# 🚀 ChatApp - Quick Start Guide

Simple guide to run ChatApp locally or deploy to Azure.

---

## ⚡ Quick Start - Local Development

### Prerequisites
- Python 3.11+ installed
- Node.js 18+ installed
- MongoDB running (local or Docker)

### Run Locally

**Windows:**
```batch
run-local.bat
```

**Linux/Mac:**
```bash
./run-local.sh
```

This will start:
- **Backend:** http://localhost:5000
- **Frontend:** http://localhost:3000

Open http://localhost:3000 in your browser!

---

## 🔧 Manual Start (Alternative)

If you prefer to run each service manually:

**Terminal 1 - Backend:**
```batch
cd backend
python app.py
```

**Terminal 2 - Frontend:**
```batch
cd frontend
npm install       # First time only
npm run dev
```

---

## ☁️ Deploy to Azure

```batch
deploy-azure.bat
```

This will:
1. Build frontend as static files
2. Create Docker image with both frontend + backend
3. Deploy to Azure Container Apps

**Environment Variables for Azure:**
- `AZURE_COSMOS_CONNECTIONSTRING` - Your CosmosDB connection string
- `AZURE_COSMOS_DATABASE` - Database name (default: chatapp)

---

## 📍 Application Endpoints

### Local Development
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Socket.IO:** ws://localhost:5000/socket.io

### API Routes
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/topics` - List all topics
- `POST /api/topics` - Create new topic
- `GET /api/topics/:id/messages` - Get topic messages
- `POST /api/messages` - Send message
- More routes in backend/routes/

### Socket.IO Events
- `connect` - Client connected
- `join_topic` - Join a chat topic
- `send_message` - Send message to topic
- `typing_start` - User started typing
- `typing_stop` - User stopped typing

---

## 🗄️ Database Setup

### Option 1: MongoDB with Docker (Recommended)
```batch
docker run -d --name mongodb-test -p 27017:27017 mongo:7.0
```

### Option 2: MongoDB Local Install
Download and install from: https://www.mongodb.com/try/download/community

### Option 3: Azure CosmosDB (Production)
- Create CosmosDB with MongoDB API in Azure Portal
- Set `AZURE_COSMOS_CONNECTIONSTRING` environment variable

---

## 🐛 Troubleshooting

### Backend won't start
- Make sure MongoDB is running
- Check if port 5000 is available: `netstat -ano | findstr :5000`
- Check Python dependencies: `pip install -r backend/requirements.txt`

### Frontend won't start
- Make sure port 3000 is available
- Install dependencies: `cd frontend && npm install`
- Check Node version: `node --version` (should be 18+)

### MongoDB connection failed
- Start MongoDB: `docker start mongodb-test`
- Or check if MongoDB service is running locally

### Need more help?
See **WINDOWS_TROUBLESHOOTING.md** for detailed Windows-specific solutions.

---

## 📁 Project Structure

```
RINTEP2/
├── backend/                 # Flask backend
│   ├── app.py              # Main application
│   ├── config.py           # Configuration (local/Azure)
│   ├── routes/             # API routes
│   ├── models/             # Data models
│   ├── services/           # Business logic
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # Next.js frontend
│   ├── pages/             # React pages
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   ├── styles/            # CSS styles
│   └── package.json       # Node dependencies
│
├── run-local.bat          # Start locally (Windows)
├── run-local.sh           # Start locally (Linux/Mac)
└── deploy-azure.bat       # Deploy to Azure
```

---

## 🎯 Key Features

- **Real-time Chat** - WebSocket communication with Socket.IO
- **Anonymous Mode** - Chat anonymously in topics
- **TOTP Authentication** - Two-factor authentication
- **Topic-based Rooms** - Create and join chat topics
- **Private Messages** - Direct messaging between users
- **Content Filtering** - Automatic profanity and link filtering
- **Theme Support** - Dark/Light mode
- **i18n** - English and Portuguese support
- **Azure Ready** - Easy deployment to Azure

---

## 🔐 Security Features

- TOTP 2FA with QR code setup
- Backup codes for account recovery
- Session management
- Content filtering and moderation
- Rate limiting on sensitive endpoints
- CORS configuration
- Secure cookie settings

---

**Ready to start? Run `run-local.bat` and open http://localhost:3000!** 🚀
