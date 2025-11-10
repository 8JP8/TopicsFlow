from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_session import Session
from pymongo import MongoClient
from config import config
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize extensions
socketio = SocketIO()
cors = CORS()
session = Session()

def create_app(config_name=None):
    """Create and configure Flask application."""
    app = Flask(__name__)

    # Load configuration
    config_name = config_name or os.getenv('FLASK_ENV', 'default')
    app.config.from_object(config[config_name])

    # Initialize extensions
    cors.init_app(app, origins=[app.config['FRONTEND_URL']])
    session.init_app(app)

    # Initialize SocketIO with session support
    socketio.init_app(app,
                     cors_allowed_origins=[app.config['FRONTEND_URL']],
                     async_mode='eventlet')

    # Database connection
    try:
        client = MongoClient(app.config['MONGO_URI'])
        app.db = client[app.config['MONGO_DB_NAME']]
        logger.info("Connected to MongoDB successfully")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise

    # Register blueprints
    from routes.auth import auth_bp
    from routes.topics import topics_bp
    from routes.messages import messages_bp
    from routes.reports import reports_bp
    from routes.users import users_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(topics_bp, url_prefix='/api/topics')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(users_bp, url_prefix='/api/users')

    # Register SocketIO handlers
    from socketio_handlers import register_socketio_handlers
    register_socketio_handlers(socketio)

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'service': 'chatapp-backend'}

    @app.route('/')
    def index():
        return {'message': 'ChatApp Backend API', 'version': '1.0.0'}

    return app

def create_db_indexes(app):
    """Create database indexes for better performance."""
    try:
        db = app.db

        # Users collection indexes
        db.users.create_index("username", unique=True)
        db.users.create_index("email", unique=True)
        db.users.create_index("ip_addresses")

        # Topics collection indexes
        db.topics.create_index("created_at")
        db.topics.create_index("member_count", -1)
        db.topics.create_index("last_activity", -1)
        db.topics.create_index("tags")

        # Messages collection indexes
        db.messages.create_index([("topic_id", 1), ("created_at", -1)])
        db.messages.create_index("user_id")
        db.messages.create_index("created_at")

        # Reports collection indexes
        db.reports.create_index([("topic_id", 1), ("status", 1)])
        db.reports.create_index("created_at")

        # Private messages collection indexes
        db.private_messages.create_index([("from_user_id", 1), ("to_user_id", 1)])
        db.private_messages.create_index([("to_user_id", 1), ("created_at", -1)])
        db.private_messages.create_index("created_at")

        # Anonymous identities collection indexes
        db.anonymous_identities.create_index([("user_id", 1), ("topic_id", 1)], unique=True)

        logger.info("Database indexes created successfully")

    except Exception as e:
        logger.error(f"Failed to create database indexes: {e}")
        raise

if __name__ == '__main__':
    app = create_app()

    # Create database indexes
    create_db_indexes(app)

    # Run the application
    socketio.run(app,
                host='0.0.0.0',
                port=int(os.getenv('PORT', 5000)),
                debug=app.config.get('DEBUG', False))