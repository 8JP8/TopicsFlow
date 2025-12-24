from flask import Flask, send_from_directory, send_file, redirect
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_session import Session
from pymongo import MongoClient
import os
import sys
import time
import logging
# Import config from config.py (avoiding conflict with config/ directory)
# Import directly from the file using importlib to avoid package conflict
import importlib.util
config_path = os.path.join(os.path.dirname(__file__), 'config.py')
spec = importlib.util.spec_from_file_location("config_module", config_path)
config_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config_module)
config = config_module.config

# Import extensions to avoid circular imports
from extensions import socketio, cors, session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

    # Initialize extensions with CORS
    # Allow local development and the production frontend URL from environment
    frontend_url = app.config.get('FRONTEND_URL')
    
    allowed_origins = [
        "https://topicsflow.me",
        "topicsflow.me",
        "20.101.2.157",
        "20.101.2.157:80",
        "20.101.2.157:443",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://192.168.1.252:3000",
    ]
    
    if frontend_url:
        # Support both with and without trailing slash
        allowed_origins.append(frontend_url.rstrip('/'))
        allowed_origins.append(f"{frontend_url.rstrip('/')}/")
        logger.info(f"CORS: Adding production frontend URL to allowed origins: {frontend_url}")
    
    logger.info(f"CORS: Configured with allowed origins: {allowed_origins}")
    
    # Always enable Flask-CORS, even in Azure, to ensure correct headers are sent
    # Azure's default CORS handling can be problematic with credentials (cookies)
    cors.init_app(app, 
                 resources={r"/*": {"origins": allowed_origins}},
                 allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
                 methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                 supports_credentials=True)  # Enable credentials for session cookies

    # Configure Flask-Session backend
    # Azure App Service must use Redis to avoid passkey challenge/session loss across instances.
    # Local development: Never use Redis (use filesystem sessions and direct DB queries)
    try:
        is_azure = app.config.get('IS_AZURE', False)
        session_type = (app.config.get('SESSION_TYPE') or 'filesystem').lower()
        
        # Only attempt Redis if:
        # 1. We're in Azure, OR
        # 2. SESSION_TYPE is explicitly set to 'redis' AND we have REDIS_URL AND we're not forcing local mode
        # Never use Redis in local development (non-Docker, non-Azure)
        # Even if REDIS_URL is set in .env, ignore it in local development
        should_use_redis = (
            is_azure or 
            (session_type == 'redis' and app.config.get('REDIS_URL') and not os.getenv('FORCE_LOCAL_MODE') and is_azure)
        )
        
        # Force filesystem sessions in local development, even if REDIS_URL is set
        if not is_azure and not os.getenv('FORCE_AZURE_MODE'):
            should_use_redis = False
            if session_type == 'redis':
                logger.info("Local development detected: Ignoring REDIS_URL and SESSION_TYPE=redis. Using filesystem sessions.")
                session_type = 'filesystem'
                app.config['SESSION_TYPE'] = 'filesystem'
        
        if should_use_redis and session_type == 'redis':
            import redis  # backend/requirements.txt includes redis
            redis_url = app.config.get('REDIS_URL')

            def _parse_azure_redis_connection(value: str) -> dict:
                """
                Parse Azure Redis connection string format:
                  host:port,password=...,ssl=True,abortConnect=False
                Returns dict with host, port, password, ssl for direct Redis() constructor.
                """
                if not value:
                    return None
                if '://' in value:
                    # Already a URL format, return None to use from_url
                    return None
                
                # Parse StackExchange format
                parts = [p.strip() for p in value.split(',') if p.strip()]
                host_port = parts[0]
                password = None
                username = None
                ssl = True
                
                for p in parts[1:]:
                    if p.lower().startswith('password='):
                        password = p.split('=', 1)[1]
                    elif p.lower().startswith('username='):
                        username = p.split('=', 1)[1]
                    elif p.lower().startswith('ssl='):
                        ssl_val = p.split('=', 1)[1].strip().lower()
                        ssl = ssl_val in ('true', '1', 'yes')
                
                # Parse host:port
                if ':' in host_port:
                    host, port = host_port.rsplit(':', 1)
                    port = int(port)
                else:
                    host = host_port
                    port = 6380 if ssl else 6379
                
                return {
                    'host': host,
                    'port': port,
                    'password': password,
                    'ssl': ssl,
                    'username': username
                }

            # Try to parse as Azure format first, then fallback to URL
            redis_params = _parse_azure_redis_connection(redis_url) if redis_url else None
            
            if redis_url:
                # Test Redis connection before using it
                try:
                    if redis_params:
                        # Use direct Redis() constructor (preferred for Azure)
                        redis_client = redis.Redis(
                            host=redis_params['host'],
                            port=redis_params['port'],
                            password=redis_params['password'],
                            ssl=redis_params['ssl'],
                            username=redis_params.get('username'),
                            socket_connect_timeout=5,
                            socket_timeout=5,
                            decode_responses=False  # Keep bytes for session storage
                        )
                    else:
                        # Use URL format (for standard Redis URLs)
                        redis_client = redis.from_url(redis_url, socket_connect_timeout=5, socket_timeout=5)
                    
                    # Test connection with ping
                    redis_client.ping()
                    
                    # Store Redis client for later use (for both sessions and cache)
                    app.config['REDIS_CLIENT'] = redis_client
                    app.config['SESSION_REDIS'] = redis_client
                    app.config['_USE_REDIS_FALLBACK'] = True  # Flag to use fallback interface
                    app.config['REDIS_AVAILABLE'] = True
                    logger.info("Redis connection successful. Session backend: Redis with filesystem fallback (connection verified)")
                except (redis.exceptions.ConnectionError, redis.exceptions.AuthenticationError, redis.exceptions.TimeoutError) as redis_err:
                    logger.error("Redis connection failed. Falling back to filesystem sessions and direct database queries.")
                    logger.error(f"Redis error: {redis_err}")
                    app.config['SESSION_TYPE'] = 'filesystem'
                    app.config['REDIS_AVAILABLE'] = False
                except Exception as redis_err:
                    logger.error("Redis connection failed. Falling back to filesystem sessions and direct database queries.")
                    logger.error(f"Unexpected Redis error: {redis_err}")
                    app.config['SESSION_TYPE'] = 'filesystem'
                    app.config['REDIS_AVAILABLE'] = False
            else:
                logger.warning("SESSION_TYPE=redis but REDIS_URL is missing; falling back to filesystem sessions")
                app.config['SESSION_TYPE'] = 'filesystem'
                app.config['REDIS_AVAILABLE'] = False
        else:
            # Local development: filesystem sessions, no Redis
            if not is_azure:
                logger.info(f"Session backend: {session_type} (local development - Redis disabled)")
            else:
                logger.info(f"Session backend: {session_type}")
            # If not using Redis, mark as unavailable
            app.config['REDIS_AVAILABLE'] = False
    except Exception as e:
        logger.warning(f"Failed to configure session backend; falling back to filesystem: {e}")
        app.config['SESSION_TYPE'] = 'filesystem'
        app.config['REDIS_AVAILABLE'] = False

    # Initialize Flask-Session
    session.init_app(app)
    
    # If Redis is configured and working, replace with fallback interface
    if app.config.get('_USE_REDIS_FALLBACK') and app.config.get('SESSION_REDIS'):
        try:
            from utils.session_fallback import FallbackSessionInterface
            if FallbackSessionInterface:
                redis_client = app.config['SESSION_REDIS']
                session_interface = FallbackSessionInterface(
                    redis_client=redis_client,
                    key_prefix=app.config.get('SESSION_KEY_PREFIX', 'session:'),
                    use_signer=app.config.get('SESSION_USE_SIGNER', False),
                    permanent=app.config.get('SESSION_PERMANENT', False),
                    session_file_dir=app.config.get('SESSION_FILE_DIR')
                )
                app.session_interface = session_interface
                logger.info("Configured Redis session with filesystem fallback")
            else:
                logger.warning("FallbackSessionInterface not available. Using default Redis session interface.")
        except ImportError as e:
            logger.warning(f"Failed to import fallback session interface: {e}. Using default.")
        except Exception as e:
            logger.warning(f"Failed to configure fallback session interface: {e}. Using default.")

    # Initialize Redis Cache and Cache Invalidator
    try:
        from utils.redis_cache import RedisCache
        from utils.cache_invalidator import CacheInvalidator
        
        redis_available = app.config.get('REDIS_AVAILABLE', False)
        redis_client = app.config.get('REDIS_CLIENT')
        is_azure = app.config.get('IS_AZURE', False)
        
        if redis_available and redis_client:
            cache = RedisCache(redis_client=redis_client, available=True)
            cache_invalidator = CacheInvalidator(cache=cache)
            app.config['CACHE'] = cache
            app.config['CACHE_INVALIDATOR'] = cache_invalidator
            logger.info("Redis cache enabled. TTL: users/topics=1h, dynamic=5m")
        else:
            # Redis unavailable, create cache instance that always returns None
            cache = RedisCache(redis_client=None, available=False)
            cache_invalidator = CacheInvalidator(cache=None)
            app.config['CACHE'] = cache
            app.config['CACHE_INVALIDATOR'] = cache_invalidator
            # Only log as error if we were supposed to use Redis (Azure/Docker)
            # In local development, this is expected behavior - don't log as error
            is_azure_check = app.config.get('IS_AZURE', False)
            if is_azure_check or (app.config.get('SESSION_TYPE') == 'redis' and app.config.get('REDIS_URL') and not os.getenv('FORCE_LOCAL_MODE')):
                logger.error("Redis connection failed. Falling back to filesystem sessions and direct database queries. Application will continue without caching.")
            else:
                # Local development - Redis disabled by design, not an error
                # Don't log anything - this is expected behavior
                pass
    except Exception as e:
        logger.error(f"Failed to initialize cache system: {e}. Application will continue without caching.")
        # Create dummy cache that always fails gracefully
        from utils.redis_cache import RedisCache
        from utils.cache_invalidator import CacheInvalidator
        cache = RedisCache(redis_client=None, available=False)
        cache_invalidator = CacheInvalidator(cache=None)
        app.config['CACHE'] = cache
        app.config['CACHE_INVALIDATOR'] = cache_invalidator

    # Initialize SocketIO with session support
    # Use threading mode on Windows (eventlet not reliable on Windows)
    async_mode = 'threading' if sys.platform == 'win32' else 'eventlet'
    logger.info(f"Using SocketIO async_mode: {async_mode}")

    # SocketIO CORS - same origins as main app
    socketio.init_app(app, 
                     cors_allowed_origins=allowed_origins,
                     async_mode=async_mode,
                     cors_credentials=True)  # Enable credentials for session cookies

    # Database connection
    while True:
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
            break  # Exit loop if successful
        except Exception as e:
            logger.warning(f"Database connection failed: {e}")
            logger.info("Retrying in 30 seconds...")
            time.sleep(30)

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

            # Check for 404.html first
            not_found_path = os.path.join(static_folder, '404.html')
            if path == '404' or path == '404.html':
                if os.path.exists(not_found_path):
                    return send_file(not_found_path), 404
            
            # Serve index.html for all other routes (SPA)
            index_path = os.path.join(static_folder, 'index.html')
            if os.path.exists(index_path):
                return send_file(index_path)

            # If we get here and it's a 404 request, return 404.html
            if os.path.exists(not_found_path):
                return send_file(not_found_path), 404
            
            from flask import abort
            abort(404)
    else:
        logger.info("No static frontend folder - API only mode")

        @app.route('/')
        def index():
            if app.config.get('IS_AZURE'):
                # Return a styled HTML page with JS countdown
                return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>TopicsFlow API</title>
                    <style>
                        body {
                            background-color: #0f172a;
                            color: #f8fafc;
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            text-align: center;
                        }
                        .container {
                            max-width: 600px;
                            padding: 2rem;
                        }
                        h1 {
                            font-size: 2.5rem;
                            font-weight: 700;
                            margin-bottom: 1rem;
                            background: linear-gradient(to right, #60a5fa, #a78bfa);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                        }
                        p {
                            font-size: 1.25rem;
                            color: #94a3b8;
                            margin-bottom: 2rem;
                        }
                        .countdown {
                            font-weight: 600;
                            color: #f8fafc;
                        }
                        .loader {
                            width: 40px;
                            height: 40px;
                            border: 3px solid #334155;
                            border-radius: 50%;
                            border-top-color: #60a5fa;
                            animation: spin 1s ease-in-out infinite;
                            margin: 0 auto 1.5rem;
                        }
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="loader"></div>
                        <h1>TopicsFlow API is Online</h1>
                        <p>Redirecting to frontend in <span id="timer" class="countdown">3</span>s...</p>
                    </div>
                    <script>
                        let seconds = 3;
                        const timer = document.getElementById('timer');
                        
                        const interval = setInterval(() => {
                            seconds--;
                            timer.textContent = seconds;
                            
                            if (seconds <= 0) {
                                clearInterval(interval);
                                window.location.href = "https://topicsflow.me";
                            }
                        }, 1000);
                    </script>
                </body>
                </html>
                """, 200
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

        # Friends collection indexes (for Azure Cosmos DB compatibility)
        try:
            db.friends.create_index([("from_user_id", 1), ("status", 1), ("updated_at", -1)])
            db.friends.create_index([("to_user_id", 1), ("status", 1), ("updated_at", -1)])
            db.friends.create_index([("from_user_id", 1), ("status", 1)])
            db.friends.create_index([("to_user_id", 1), ("status", 1)])
        except Exception as e:
            logger.warning(f"Failed to create some friends indexes (may already exist): {e}")

        # Comments composite index for order-by queries (Azure Cosmos DB)
        try:
            db.comments.create_index([("post_id", 1), ("upvote_count", -1), ("created_at", -1)])
            db.comments.create_index([("post_id", 1), ("created_at", -1), ("upvote_count", -1)])
        except Exception as e:
            logger.warning(f"Failed to create some comments indexes (may already exist): {e}")

        logger.info("Database indexes created successfully")

    except Exception as e:
        logger.error(f"Failed to create database indexes: {e}")
        raise


# Create global app instance for Gunicorn/production
app = create_app()

# Create database indexes
create_db_indexes(app)

if __name__ == '__main__':

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