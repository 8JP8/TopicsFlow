
import sys
import os
import os
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.getcwd())

try:
    from utils.session_fallback import FallbackSessionInterface
    print("Successfully imported FallbackSessionInterface")
except ImportError as e:
    print(f"Failed to import: {e}")
    sys.exit(1)

if FallbackSessionInterface is None:
    print("FallbackSessionInterface appears to be None (imports failed inside module)")
    sys.exit(1)

print("Initializing FallbackSessionInterface...")
try:
    # Mock redis client
    redis_mock = MagicMock()
    
    # Initialize
    interface = FallbackSessionInterface(
        redis_client=redis_mock,
        key_prefix='test:',
        use_signer=False,
        permanent=False,
        session_file_dir='./flask_session_test'
    )
    
    print("✅ FallbackSessionInterface initialized successfully!")
    print(f"Redis client: {interface._redis_client}")
    print(f"Filesystem interface: {interface.filesystem_interface}")
    
except Exception as e:
    print(f"❌ Failed to initialize: {e}")
    sys.exit(1)
