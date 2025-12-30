# Getting Started

This guide will help you set up the TopicsFlow application on your local machine for development.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Docker & Docker Compose**: Recommended for running services (MongoDB, Redis).
- **Python 3.9+**: For the backend application.
- **Node.js 18+ & npm**: For the frontend application.
- **Git**: For version control.

## 🔧 Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TopicsFlow_App
```

### 2. Environment Variables

The project uses `.env` files for configuration. A setup script is provided to generate these automatically.

**Windows:**
```powershell
.\env-setup.bat
```

**Linux/Mac:**
```bash
chmod +x env-setup.sh
./env-setup.sh
```

This script will create:
- `backend/.env`
- `frontend/.env.local`
- `.env` (root for Docker)

> **Note:** Review the generated `.env` files and update any specific secrets or API keys (e.g., Azure keys, if needed).

## 🚀 Running Locally (Manual)

### Backend (Flask)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python app.py
   ```
   The backend will run on `http://localhost:5000`.

### Frontend (Next.js)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:3000`.

### Database Services

You need MongoDB and Redis running. The easiest way is via Docker Compose:

```bash
docker-compose -f docker-compose.local.yml up -d mongo redis
```

## 🐳 Running with Docker

To run the entire stack (Frontend + Backend + DBs) using Docker:

```bash
docker-compose -f docker-compose.local.yml up --build
```

Access the application at `http://localhost:3000`.

## 🧪 Verifying Installation

Run the verification script to ensure everything is set up correctly:

**Windows:**
```powershell
.\VERIFY_SETUP.bat
```

This script checks for:
- Python & Node.js installation
- Configuration files
- Directory structure
