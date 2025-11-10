#!/bin/bash
# ========================================
#   ChatApp - Local Development
# ========================================

echo ""
echo "========================================"
echo "   Starting ChatApp Locally"
echo "========================================"
echo ""

# Set environment variable for local mode
cd backend
if [ ! -f .env ]; then
    echo "FORCE_LOCAL_MODE=true" > .env
    echo "DATABASE_URL=mongodb://localhost:27017/chatapp" >> .env
fi
cd ..

# Start Backend
echo "[1/2] Starting Backend..."
echo "   Backend will run on: http://localhost:5000"
echo ""
cd backend
gnome-terminal -- bash -c "python3 app.py; exec bash" 2>/dev/null || \
xterm -e "python3 app.py; exec bash" 2>/dev/null || \
python3 app.py &
cd ..

# Wait a bit for backend to start
sleep 3

# Start Frontend
echo "[2/2] Starting Frontend..."
echo "   Frontend will run on: http://localhost:3000"
echo ""
cd frontend
gnome-terminal -- bash -c "npm run dev; exec bash" 2>/dev/null || \
xterm -e "npm run dev; exec bash" 2>/dev/null || \
npm run dev &
cd ..

echo ""
echo "========================================"
echo "   ChatApp Started Successfully!"
echo "========================================"
echo ""
echo "Backend API:  http://localhost:5000"
echo "Frontend UI:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop (or close terminal windows)"
echo "========================================"
echo ""

# Keep script running
wait
