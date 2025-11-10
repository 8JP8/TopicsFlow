import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration class for the Flask application."""

    # Basic Flask Config
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Detect Azure environment
    IS_AZURE = os.getenv('WEBSITE_INSTANCE_ID') is not None or os.getenv('AZURE_COSMOS_CONNECTIONSTRING') is not None

    # Database Config
    # If Azure environment detected, use CosmosDB connection string
    if IS_AZURE:
        # Azure CosmosDB (MongoDB API)
        MONGO_URI = os.getenv('AZURE_COSMOS_CONNECTIONSTRING')
        MONGO_DB_NAME = os.getenv('AZURE_COSMOS_DATABASE', 'chatapp')
        # CosmosDB specific settings
        COSMOS_SSL = True
        COSMOS_RETRY_WRITES = False  # CosmosDB doesn't support retryWrites
    else:
        # Local MongoDB
        MONGO_URI = os.getenv('DATABASE_URL', 'mongodb://localhost:27017/chatapp')
        MONGO_DB_NAME = os.getenv('DB_NAME', 'chatapp')
        COSMOS_SSL = False
        COSMOS_RETRY_WRITES = True

    # CORS Config
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

    # TOTP/Auth Config
    TOTP_ISSUER = os.getenv('TOTP_ISSUER', 'ChatHub')
    TOTP_VALIDITY_WINDOW = int(os.getenv('TOTP_VALIDITY_WINDOW', '1'))

    # External Services
    SMS_SERVICE_API_KEY = os.getenv('SMS_SERVICE_API_KEY')
    SMS_SERVICE_NUMBER = os.getenv('SMS_SERVICE_NUMBER')
    EMAIL_SERVICE_API_KEY = os.getenv('EMAIL_SERVICE_API_KEY')
    TENOR_API_KEY = os.getenv('TENOR_API_KEY')

    # Redis Config (for session storage in production)
    # Azure Redis Cache or local Redis
    if IS_AZURE and os.getenv('AZURE_REDIS_CONNECTIONSTRING'):
        REDIS_URL = os.getenv('AZURE_REDIS_CONNECTIONSTRING')
    else:
        REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

    # Security Config
    SESSION_COOKIE_SECURE = os.getenv('ENVIRONMENT') == 'production'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Rate Limiting
    RATE_LIMIT_STORAGE_URL = REDIS_URL
    LOGIN_RATE_LIMIT = os.getenv('LOGIN_RATE_LIMIT', '5/minute')
    MESSAGE_RATE_LIMIT = os.getenv('MESSAGE_RATE_LIMIT', '30/minute')

    # File Upload Config
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

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
    MONGO_URI = 'mongodb://localhost:27017/chatapp_test'
    WTF_CSRF_ENABLED = False

class AzureConfig(ProductionConfig):
    """Azure deployment configuration."""
    DEBUG = False
    TESTING = False
    # Force HTTPS cookies in Azure
    SESSION_COOKIE_SECURE = True
    # Use Azure-specific settings
    IS_AZURE = True

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'azure': AzureConfig,
    'default': DevelopmentConfig
}