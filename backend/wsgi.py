"""
WSGI entry point for production deployment with Gunicorn.
This file creates the Flask application instance.
"""
import os
from app import create_app, socketio

# Create application instance
app = create_app(os.getenv('FLASK_ENV', 'production'))

# For gunicorn with eventlet worker, we need to wrap with socketio
# This ensures WebSocket support works correctly
application = app

if __name__ == "__main__":
    # This is only used for development/testing
    # In production, gunicorn will use the 'app' or 'application' object
    socketio.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 8000)))
