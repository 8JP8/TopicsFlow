"""
Custom Flask-Session interface with automatic fallback from Redis to filesystem.
This ensures that if Redis fails during runtime, the app continues to work with filesystem sessions.
"""
import logging

logger = logging.getLogger(__name__)

# Try to import Flask-Session interfaces with fallback
try:
    # Flask-Session 0.4.0+ exposes interfaces directly
    from flask_session import RedisSessionInterface, FileSystemSessionInterface
except ImportError:
    try:
        # Older versions might have them in .sessions
        from flask_session.sessions import RedisSessionInterface, FileSystemSessionInterface
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
        
        def open_session(self, app, request):
            """Open session with Redis, fallback to filesystem if Redis fails."""
            try:
                # Try Redis first (without explicit ping to save RTT)
                session = super().open_session(app, request)
                if session is not None:
                    # Success
                    import sys
                    print(f"[SESSION DEBUG] Redis open_session success for {request.path}", file=sys.stderr)
                    return session
            except Exception as e:
                import sys
                print(f"[SESSION DEBUG] Redis open_session failed: {e}", file=sys.stderr)
                logger.warning(f"Redis session open failed, using filesystem fallback: {e}")
            
            # Fallback
            print(f"[SESSION DEBUG] Using Filesystem fallback for open_session", file=sys.stderr)
            return self.filesystem_interface.open_session(app, request)
        
        def save_session(self, app, session, response):
            """Save session with Redis, fallback to filesystem if Redis fails."""
            try:
                # Try Redis first
                return super().save_session(app, session, response)
            except Exception as e:
                import sys
                print(f"[SESSION DEBUG] Redis save_session failed: {e}", file=sys.stderr)
                logger.warning(f"Redis session save failed, using filesystem fallback: {e}")
                return self.filesystem_interface.save_session(app, session, response)
else:
    # FallbackSessionInterface not available if Flask-Session interfaces can't be imported
    FallbackSessionInterface = None
