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
    logger.info(f"  TopicsFlow Backend - Mode: {env_mode}")
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
    from routes.posts import posts_bp
    from routes.comments import comments_bp
    from routes.chat_rooms import chat_rooms_bp
    from routes.messages import messages_bp
    from routes.reports import reports_bp
    from routes.users import users_bp
    from routes.friends import friends_bp
    from routes.gifs import gifs_bp
    from routes.admin import admin_bp
    from routes.tickets import tickets_bp
    from routes.content_settings import content_settings_bp
    from routes.attachments import attachments_bp
    from routes.notification_settings import notification_settings_bp
    from routes.notifications import notifications_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(topics_bp, url_prefix='/api/topics')
    app.register_blueprint(posts_bp, url_prefix='/api/posts')
    app.register_blueprint(comments_bp, url_prefix='/api/comments')
    app.register_blueprint(chat_rooms_bp, url_prefix='/api/chat-rooms')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(friends_bp, url_prefix='/api/friends')
    app.register_blueprint(gifs_bp, url_prefix='/api/gifs')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(tickets_bp, url_prefix='/api/tickets')
    app.register_blueprint(content_settings_bp, url_prefix='/api/content-settings')
    app.register_blueprint(attachments_bp, url_prefix='/api/attachments')
    app.register_blueprint(notification_settings_bp, url_prefix='/api/notification-settings')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')

    # Health check endpoint (register before static routes)
    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'service': 'topicsflow-backend'}

    # Register SocketIO handlers BEFORE static routes to ensure Socket.IO routes are processed first
    # Flask-SocketIO needs to handle /socket.io/ routes before the catch-all route
    from socketio_handlers import register_socketio_handlers
    register_socketio_handlers(socketio)

    # Serve static frontend files (for Azure deployment)
    # IMPORTANT: Register static routes AFTER SocketIO handlers to ensure Socket.IO routes are processed first
    static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

    if os.path.exists(static_folder):
        logger.info("Static frontend folder found - serving static files")

        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_frontend(path):
            """Serve static frontend files."""
            # Flask-SocketIO automatically handles /socket.io/ routes before this function is called
            # If we somehow get here for a socket.io route, Flask-SocketIO didn't handle it
            # In that case, we should not process it to avoid WSGI conflicts
            if 'socket.io' in path or path.startswith('socket.io/') or path == 'socket.io':
                # Don't process socket.io routes - Flask-SocketIO should handle them
                # Return an empty response with 200 status to avoid WSGI write() before start_response error
                from flask import Response
                return Response('', status=200, mimetype='text/plain')
            
            # Skip API routes - let blueprints handle them
            if path.startswith('api/'):
                from flask import abort
                abort(404)
            
            # Skip .well-known routes (for PWA, Chrome DevTools, etc.)
            if path.startswith('.well-known/'):
                from flask import abort
                abort(404)
            
            # Skip icons routes if they don't exist
            if path.startswith('icons/'):
                from flask import abort
                abort(404)

            # Serve static files
            if path != "" and os.path.exists(os.path.join(static_folder, path)):
                return send_from_directory(static_folder, path)

            # Serve index.html for all other routes (SPA)
            index_path = os.path.join(static_folder, 'index.html')
            if os.path.exists(index_path):
                return send_file(index_path)

            from flask import abort
            abort(404)
    else:
        logger.info("No static frontend folder - API only mode")

        @app.route('/')
        def index():
            return {'message': 'TopicsFlow Backend API', 'version': '1.0.0'}

    return app

def create_db_indexes(app):
    """Create database indexes for better performance."""
    try:
        db = app.db

        # Users collection indexes
        db.users.create_index("username", unique=True)
        db.users.create_index("email", unique=True)
        db.users.create_index("ip_addresses")
        db.users.create_index("blocked_users")
        db.users.create_index("is_admin")
        db.users.create_index("is_banned")
        db.users.create_index("banned_at")
        db.users.create_index("created_at")

        # Topics collection indexes (main containers)
        db.topics.create_index("created_at")
        db.topics.create_index([("member_count", -1)])
        db.topics.create_index([("last_activity", -1)])
        db.topics.create_index([("post_count", -1)])  # Number of posts
        db.topics.create_index([("conversation_count", -1)])  # Number of conversations
        db.topics.create_index("tags")
        db.topics.create_index("owner_id")
        db.topics.create_index("members")
        db.topics.create_index("banned_users")

        # Posts collection indexes (within Topics)
        db.posts.create_index([("topic_id", 1), ("created_at", -1)])  # Posts belong to topics
        db.posts.create_index([("topic_id", 1), ("score", -1)])  # Sort by score
        db.posts.create_index([("topic_id", 1), ("score", -1), ("created_at", -1)])  # For hot sorting
        db.posts.create_index("user_id")
        db.posts.create_index("created_at")
        db.posts.create_index([("score", -1)])  # New: score = upvotes - downvotes
        db.posts.create_index([("upvote_count", -1)])
        db.posts.create_index("upvotes")
        db.posts.create_index("downvotes")  # New: downvotes
        db.posts.create_index("is_deleted")

        # Comments collection indexes (new)
        db.comments.create_index([("post_id", 1), ("created_at", -1)])
        db.comments.create_index([("post_id", 1), ("upvote_count", -1)])
        db.comments.create_index("parent_comment_id")
        db.comments.create_index("user_id")
        db.comments.create_index("created_at")
        db.comments.create_index([("upvote_count", -1)])
        db.comments.create_index("upvotes")
        db.comments.create_index("depth")
        db.comments.create_index("is_deleted")

        # Chat rooms (Conversations) collection indexes (within Topics)
        db.chat_rooms.create_index("topic_id")  # Conversations belong to Topics
        db.chat_rooms.create_index([("topic_id", 1), ("last_activity", -1)])
        db.chat_rooms.create_index([("topic_id", 1), ("tags", 1)])  # Filter by tags
        db.chat_rooms.create_index("owner_id")
        db.chat_rooms.create_index("moderators")  # New: moderators
        db.chat_rooms.create_index("members")
        db.chat_rooms.create_index("banned_users")  # New: banned users
        db.chat_rooms.create_index("tags")  # New: tags for search
        db.chat_rooms.create_index("is_public")
        db.chat_rooms.create_index("created_at")

        # Messages collection indexes (updated)
        db.messages.create_index([("topic_id", 1), ("created_at", -1)])  # Legacy
        db.messages.create_index([("chat_room_id", 1), ("created_at", -1)])  # New
        db.messages.create_index([("post_id", 1), ("created_at", -1)])  # New
        db.messages.create_index([("comment_id", 1), ("created_at", -1)])  # New
        db.messages.create_index("user_id")
        db.messages.create_index("created_at")
        db.messages.create_index("mentions")
        db.messages.create_index("is_deleted")

        # Reports collection indexes
        db.reports.create_index([("reported_content_id", 1), ("content_type", 1)])
        db.reports.create_index("content_type")
        db.reports.create_index("report_type")
        db.reports.create_index("reported_user_id")
        db.reports.create_index("reported_by")
        db.reports.create_index("created_at")
        db.reports.create_index("status")
        db.reports.create_index([("topic_id", 1), ("status", 1)])
        db.reports.create_index([("status", 1), ("created_at", -1)])

        # Tickets collection indexes
        db.tickets.create_index("user_id")
        db.tickets.create_index("status")
        db.tickets.create_index("category")
        db.tickets.create_index("priority")
        db.tickets.create_index([("status", 1), ("priority", -1), ("created_at", -1)])
        db.tickets.create_index("created_at")
        db.tickets.create_index("reviewed_by")

        # Conversation settings collection indexes
        db.conversation_settings.create_index([("user_id", 1), ("other_user_id", 1)], unique=True)
        db.conversation_settings.create_index([("user_id", 1), ("topic_id", 1), ("type", 1)], unique=True, sparse=True)
        db.conversation_settings.create_index([("user_id", 1), ("chat_room_id", 1), ("type", 1)], unique=True, sparse=True)
        db.conversation_settings.create_index("type")

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