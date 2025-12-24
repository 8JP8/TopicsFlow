"""
Custom Flask-Session interface with automatic fallback from Redis to filesystem.
This ensures that if Redis fails during runtime, the app continues to work with filesystem sessions.
"""
import logging

logger = logging.getLogger(__name__)

# Try to import Flask-Session interfaces with fallback
try:
    from flask_session.sessions import RedisSessionInterface, FileSystemSessionInterface
except ImportError:
    try:
        # Alternative import path for some Flask-Session versions
        from flask_session import RedisSessionInterface, FileSystemSessionInterface
    except ImportError:
        logger.error("Flask-Session interfaces not available. Fallback session interface disabled.")
        RedisSessionInterface = None
        FileSystemSessionInterface = None


# Only define the class if interfaces are available
if RedisSessionInterface and FileSystemSessionInterface:
    class FallbackSessionInterface(RedisSessionInterface):
        """Session interface that falls back to filesystem if Redis fails."""
        
        def __init__(self, redis_client, key_prefix, use_signer, permanent, 
                     session_file_dir, **kwargs):
            # Initialize Redis interface
            super().__init__(redis_client, key_prefix, use_signer, permanent)
            # Store filesystem interface as fallback
            # FileSystemSessionInterface needs: cache_dir, threshold, mode, key_prefix, use_signer, permanent
            import os
            cache_dir = session_file_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), 'flask_session')
            self.filesystem_interface = FileSystemSessionInterface(
                cache_dir=cache_dir,
                threshold=500,  # Default threshold
                mode=384,  # Default mode (0o600 in octal)
                key_prefix=key_prefix,
                use_signer=use_signer,
                permanent=permanent
            )
            self._redis_available = True
            self._redis_client = redis_client
        
        def _test_redis(self):
            """Test if Redis is available."""
            if not self._redis_available:
                return False
            try:
                self._redis_client.ping()
                return True
            except Exception as e:
                logger.warning(f"Redis unavailable, using filesystem fallback: {e}")
                self._redis_available = False
                return False
        
        def open_session(self, app, request):
            """Open session with Redis, fallback to filesystem if Redis fails."""
            if self._test_redis():
                try:
                    return super().open_session(app, request)
                except Exception as e:
                    logger.warning(f"Redis session open failed, using filesystem fallback: {e}")
                    self._redis_available = False
                    return self.filesystem_interface.open_session(app, request)
            else:
                return self.filesystem_interface.open_session(app, request)
        
        def save_session(self, app, session, response):
            """Save session with Redis, fallback to filesystem if Redis fails."""
            if self._test_redis():
                try:
                    return super().save_session(app, session, response)
                except Exception as e:
                    logger.warning(f"Redis session save failed, using filesystem fallback: {e}")
                    self._redis_available = False
                    return self.filesystem_interface.save_session(app, session, response)
            else:
                return self.filesystem_interface.save_session(app, session, response)
else:
    # FallbackSessionInterface not available if Flask-Session interfaces can't be imported
    FallbackSessionInterface = None
