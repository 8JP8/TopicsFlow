import os
from dotenv import load_dotenv

# Load .env file from backend directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)
# Also try loading from parent directory (project root)
load_dotenv()

class Config:
    """Configuration class for the Flask application."""

    # Basic Flask Config
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Detect Azure environment
    # Priority 1: Explicit override (for testing)
    # Priority 2: Azure-specific env vars
    _force_azure = os.getenv('FORCE_AZURE_MODE', '').lower() in ('true', '1', 'yes')
    _force_local = os.getenv('FORCE_LOCAL_MODE', '').lower() in ('true', '1', 'yes')

    if _force_local:
        IS_AZURE = False
    elif _force_azure:
        IS_AZURE = True
    else:
        # Auto-detect: Azure App Service or Azure Cosmos connection
        IS_AZURE = (
            os.getenv('WEBSITE_INSTANCE_ID') is not None or  # Azure App Service
            os.getenv('AZURE_DEPLOYMENT', '').lower() == 'true'  # Explicit Azure flag
        )

    # Database Config
    # If Azure environment detected, use CosmosDB connection string
    if IS_AZURE:
        # Check for user-provided COSMOS keys first (Standardized names)
        if os.getenv('COSMOS_DB_URI'):
            MONGO_URI = os.getenv('COSMOS_DB_URI')
            MONGO_DB_NAME = os.getenv('COSMOS_DB_NAME', 'topicsflow')
        else:
            # Azure App Service default connection strings
            MONGO_URI = os.getenv('AZURE_COSMOS_CONNECTIONSTRING')
            MONGO_DB_NAME = os.getenv('AZURE_COSMOS_DATABASE', 'TopicsFlow')
            
        # CosmosDB specific settings
        COSMOS_SSL = True
        COSMOS_RETRY_WRITES = False  # CosmosDB doesn't support retryWrites
    else:
        # Local MongoDB
        MONGO_URI = os.getenv('DATABASE_URL', os.getenv('MONGO_URI', 'mongodb://localhost:27017/TopicsFlow'))
        MONGO_DB_NAME = os.getenv('DB_NAME', 'TopicsFlow')
        COSMOS_SSL = False
        COSMOS_RETRY_WRITES = True

    # CORS Config - Restricted to localhost only for security
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    CORS_ALLOW_ALL = os.getenv('CORS_ALLOW_ALL', 'false').lower() == 'true'

    # TOTP/Auth Config
    TOTP_ISSUER = os.getenv('TOTP_ISSUER', 'TopicsFlow')
    TOTP_VALIDITY_WINDOW = int(os.getenv('TOTP_VALIDITY_WINDOW', '1'))
    PASSKEY_RP_ID = os.getenv('PASSKEY_RP_ID')  # Optional: Will auto-derive from FRONTEND_URL if not set

    # External Services
    SMS_SERVICE_API_KEY = os.getenv('SMS_SERVICE_API_KEY')
    SMS_SERVICE_NUMBER = os.getenv('SMS_SERVICE_NUMBER')
    RESEND_API_KEY = os.getenv('RESEND_API_KEY')  # Resend email service API key
    FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@topicsflow.me')  # Sender email address
    APP_NAME = os.getenv('APP_NAME', 'TopicsFlow')  # Application name for emails
    TENOR_API_KEY = os.getenv('TENOR_API_KEY')

    # Redis Config (for session storage in production)
    # Azure Redis Cache or local Redis
    if IS_AZURE and os.getenv('AZURE_REDIS_CONNECTIONSTRING'):
        REDIS_URL = os.getenv('AZURE_REDIS_CONNECTIONSTRING')
    else:
        # Local/dev: do not assume Redis exists unless explicitly configured
        REDIS_URL = os.getenv('REDIS_URL')

    # Session Config
    # IMPORTANT: Passkeys/WebAuthn relies on the challenge stored in the server session.
    # In Azure App Service (multi-instance), you must use a shared session backend (Redis)
    # or challenge verification will randomly fail when requests hit different instances.
    #
    # Local/dev: never require Redis (filesystem sessions are fine and simpler).
    if IS_AZURE and os.getenv('AZURE_REDIS_CONNECTIONSTRING'):
        SESSION_TYPE = os.getenv('SESSION_TYPE', 'redis')
    elif os.getenv('REDIS_URL'):
        # Allow local Redis if explicitly configured
        SESSION_TYPE = os.getenv('SESSION_TYPE', 'redis')
    else:
        # Default to filesystem if no Redis configured
        SESSION_TYPE = os.getenv('SESSION_TYPE', 'filesystem')
        if SESSION_TYPE == 'redis': 
             SESSION_TYPE = 'filesystem' # Fallback if requested but no URL
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = False  # Disabled to avoid bytes-to-string conversion issues with Werkzeug
    SESSION_FILE_DIR = os.path.join(os.path.dirname(__file__), 'flask_session')
    SESSION_COOKIE_NAME = 'session'

    # Security Config
    # If cookies are used across different sites (e.g., frontend on topicsflow.me and backend on azurewebsites.net),
    # browsers will not send the session cookie unless SameSite=None and Secure=true.
    SESSION_COOKIE_SECURE = IS_AZURE or (os.getenv('ENVIRONMENT') == 'production')
    SESSION_COOKIE_HTTPONLY = True
    # Only use SameSite=None when Secure cookies are enabled; otherwise browsers may reject the cookie.
    SESSION_COOKIE_SAMESITE = 'None' if SESSION_COOKIE_SECURE else 'Lax'

    # Rate Limiting
    RATE_LIMIT_STORAGE_URL = REDIS_URL
    LOGIN_RATE_LIMIT = os.getenv('LOGIN_RATE_LIMIT', '5/minute')
    MESSAGE_RATE_LIMIT = os.getenv('MESSAGE_RATE_LIMIT', '30/minute')

    # File Upload Config
    MAX_CONTENT_LENGTH = 1 * 1024 * 1024 * 1024  # 1GB
    
    # File Storage Config
    AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    AZURE_STORAGE_CONTAINER = os.getenv('AZURE_STORAGE_CONTAINER', os.getenv('AZURE_STORAGE_CONTAINER_NAME', 'uploads'))
    
    # Auto-enable Azure Storage if running in Azure or if connection string is present
    if (IS_AZURE and AZURE_STORAGE_CONNECTION_STRING) or (os.getenv('USE_AZURE_STORAGE', 'false').lower() == 'true'):
        USE_AZURE_STORAGE = True
    else:
        USE_AZURE_STORAGE = False
        
    UPLOADS_DIR = os.getenv('UPLOADS_DIR', os.path.join(os.path.dirname(__file__), 'uploads'))
    FILE_ENCRYPTION_KEY = os.getenv('FILE_ENCRYPTION_KEY', SECRET_KEY)  # Use SECRET_KEY as default

    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    @staticmethod
    def init_app(app):
        """Initialize application with configuration."""
        pass

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    MONGO_URI = 'mongodb://localhost:27017/TopicsFlow_test'
    WTF_CSRF_ENABLED = False

class AzureConfig(ProductionConfig):
    """Azure deployment configuration."""
    DEBUG = False
    TESTING = False
    # Force HTTPS cookies in Azure
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'None'
    # Use Azure-specific settings
    IS_AZURE = True

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'azure': AzureConfig,
    'default': DevelopmentConfig
}