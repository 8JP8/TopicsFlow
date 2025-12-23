#!/bin/bash
# Azure App Service startup script
# This script ensures dependencies are installed before starting the app

set -e  # Exit on error

echo "=========================================="
echo "TopicsFlow Backend - Azure Startup"
echo "=========================================="

# Navigate to app directory (Azure App Service default location)
cd /home/site/wwwroot

# Check if we're in backend directory or root
if [ -f "backend/app.py" ]; then
    echo "Found backend directory, changing to it..."
    cd backend
elif [ ! -f "app.py" ] && [ ! -f "wsgi.py" ]; then
    echo "WARNING: app.py not found in current directory"
    echo "Current directory: $(pwd)"
    echo "Contents:"
    ls -la
    echo "Trying to find app.py..."
    find . -name "app.py" -type f 2>/dev/null | head -5
fi

# Install/upgrade pip first
echo "Upgrading pip..."
python3 -m pip install --upgrade pip --quiet

# Find and install requirements.txt
echo "Installing dependencies from requirements.txt..."
if [ -f "requirements.txt" ]; then
    echo "Found requirements.txt in $(pwd)"
    python3 -m pip install --no-cache-dir -r requirements.txt
elif [ -f "../requirements.txt" ]; then
    echo "Found requirements.txt in parent directory"
    python3 -m pip install --no-cache-dir -r ../requirements.txt
else
    echo "WARNING: requirements.txt not found. Installing essential packages..."
    python3 -m pip install --no-cache-dir gunicorn flask flask-socketio eventlet==0.36.1 redis
fi

# Verify eventlet is installed
echo "Verifying eventlet installation..."
python3 -c "import eventlet; print(f'[OK] eventlet version: {eventlet.__version__}')" || {
    echo "[ERROR] eventlet not installed. Installing now..."
    python3 -m pip install --no-cache-dir eventlet==0.36.1
    python3 -c "import eventlet; print(f'[OK] eventlet installed: {eventlet.__version__}')"
}

# Determine app module
if [ -f "app.py" ]; then
    APP_MODULE="app:app"
    echo "[OK] Using app.py"
elif [ -f "wsgi.py" ]; then
    APP_MODULE="wsgi:app"
    echo "[OK] Using wsgi.py"
else
    echo "[ERROR] Neither app.py nor wsgi.py found!"
    echo "Current directory: $(pwd)"
    echo "Files:"
    ls -la
    exit 1
fi

echo "=========================================="
echo "Starting gunicorn with eventlet worker..."
echo "App module: $APP_MODULE"
echo "=========================================="

# Start gunicorn
exec python3 -m gunicorn --bind=0.0.0.0:8000 --worker-class eventlet --workers=1 --timeout=120 --access-logfile - --error-logfile - $APP_MODULE

