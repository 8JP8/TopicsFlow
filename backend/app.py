from flask import Flask, send_from_directory, send_file
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_session import Session
from pymongo import MongoClient
import os
import sys
import logging
# Import config from config.py (avoiding conflict with config/ directory)
# Import directly from the file using importlib to avoid package conflict
import importlib.util
config_path = os.path.join(os.path.dirname(__file__), 'config.py')
spec = importlib.util.spec_from_file_location("config_module", config_path)
config_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config_module)
config = config_module.config

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

    # Disable strict slashes to prevent 308 redirects
    app.url_map.strict_slashes = False

    # Load configuration
    config_name = config_name or os.getenv('FLASK_ENV', 'default')
    app.config.from_object(config[config_name])

    # Log environment mode clearly
    env_mode = "🌩️  AZURE CLOUD" if app.config.get('IS_AZURE') else "🏠 LOCAL"
    logger.info("="*60)
    logger.info(f"  ChatApp Backend - Mode: {env_mode}")
    logger.info(f"  Environment: {config_name}")
    logger.info(f"  Database: {'CosmosDB' if app.config.get('IS_AZURE') else 'MongoDB'}")
    logger.info("="*60)

    # Initialize extensions with CORS restricted to localhost only
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ]
    logger.info(f"CORS: Configured for localhost only - Allowed origins: {allowed_origins}")
    cors.init_app(app,
                 resources={r"/*": {"origins": allowed_origins}},
                 allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
                 methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                 supports_credentials=True)  # Enable credentials for session cookies
    session.init_app(app)

    # Initialize SocketIO with session support
    # Use threading mode on Windows (eventlet not reliable on Windows)
    async_mode = 'threading' if sys.platform == 'win32' else 'eventlet'
    logger.info(f"Using SocketIO async_mode: {async_mode}")

    # SocketIO CORS - restricted to localhost only
    logger.info(f"SocketIO CORS: Configured for localhost only - Allowed origins: {allowed_origins}")
    socketio.init_app(app,
                     cors_allowed_origins=allowed_origins,
                     async_mode=async_mode,
                     cors_credentials=True)  # Enable credentials for session cookies

    # Database connection
    try:
        # Configure MongoDB/CosmosDB connection based on environment
        mongo_options = {}

        if app.config.get('IS_AZURE'):
            # Azure CosmosDB specific options
            mongo_options = {
                'ssl': app.config.get('COSMOS_SSL', True),
                'retryWrites': app.config.get('COSMOS_RETRY_WRITES', False),
                'serverSelectionTimeoutMS': 30000,
                'connectTimeoutMS': 30000,
                'socketTimeoutMS': 30000,
            }
            logger.info("Connecting to Azure CosmosDB...")
        else:
            # Local MongoDB options
            logger.info("Connecting to local MongoDB...")

        client = MongoClient(app.config['MONGO_URI'], **mongo_options)
        app.db = client[app.config['MONGO_DB_NAME']]

        # Test connection
        client.admin.command('ping')

        db_type = "Azure CosmosDB" if app.config.get('IS_AZURE') else "MongoDB"
        logger.info(f"Connected to {db_type} successfully")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise

    # Register blueprints
    from routes.auth import auth_bp
    from routes.topics import topics_bp
    from routes.messages import messages_bp
    from routes.reports import reports_bp
    from routes.users import users_bp
    from routes.friends import friends_bp
    from routes.gifs import gifs_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(topics_bp, url_prefix='/api/topics')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(friends_bp, url_prefix='/api/friends')
    app.register_blueprint(gifs_bp, url_prefix='/api/gifs')

    # Register SocketIO handlers
    from socketio_handlers import register_socketio_handlers
    register_socketio_handlers(socketio)

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'service': 'chatapp-backend'}

    # Serve static frontend files (for Azure deployment)
    static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

    if os.path.exists(static_folder):
        logger.info("Static frontend folder found - serving static files")

        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_frontend(path):
            """Serve static frontend files."""
            # If it's an API route, skip static file serving
            if path.startswith('api/') or path.startswith('socket.io/'):
                return {'error': 'Not found'}, 404

            # Serve static files
            if path != "" and os.path.exists(os.path.join(static_folder, path)):
                return send_from_directory(static_folder, path)

            # Serve index.html for all other routes (SPA)
            index_path = os.path.join(static_folder, 'index.html')
            if os.path.exists(index_path):
                return send_file(index_path)

            return {'error': 'Frontend not found'}, 404
    else:
        logger.info("No static frontend folder - API only mode")

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
        db.topics.create_index([("member_count", -1)])
        db.topics.create_index([("last_activity", -1)])
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
    # Use allow_unsafe_werkzeug=True on Windows to avoid threading issues
    # This is safe for development - production should use a proper WSGI server
    try:
        socketio.run(app,
                    host='0.0.0.0',
                    port=int(os.getenv('PORT', 5000)),
                    debug=app.config.get('DEBUG', False),
                    use_reloader=False,  # Disable reloader to avoid threading issues
                    log_output=True)
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {str(e)}", exc_info=True)