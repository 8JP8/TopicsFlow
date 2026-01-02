#!/bin/bash
# Install dependencies first (crucial for Azure)
python3 -m pip install --no-cache-dir -r requirements.txt

# Start Gunicorn
python3 -m gunicorn --worker-class eventlet -w 1 --bind=0.0.0.0:8000 --timeout 230 --access-logfile - --error-logfile - app:app
