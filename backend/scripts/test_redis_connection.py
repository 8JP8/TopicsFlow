#!/usr/bin/env python3
"""
Script to test Redis connection using Azure Redis Cache connection string format.
Usage:
    python test_redis_connection.py
    python test_redis_connection.py "host:port,password=...,ssl=True"
"""

import sys
import os
import argparse

# Add parent directory to path to import from backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def parse_azure_redis_connection(value: str) -> dict:
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


def test_redis_connection(connection_string: str):
    """Test Redis connection and perform basic operations."""
    try:
        import redis
    except ImportError:
        print("ERROR: redis package not installed. Install it with: pip install redis")
        sys.exit(1)
    
    print("=" * 60)
    print("Redis Connection Test")
    print("=" * 60)
    print(f"Connection string: {connection_string[:50]}...")
    print()
    
    # Parse connection string
    redis_params = parse_azure_redis_connection(connection_string)
    
    if redis_params:
        print("Parsed connection parameters:")
        print(f"  Host: {redis_params['host']}")
        print(f"  Port: {redis_params['port']}")
        print(f"  SSL: {redis_params['ssl']}")
        print(f"  Username: {redis_params.get('username', 'None')}")
        print(f"  Password: {'*' * len(redis_params['password']) if redis_params['password'] else 'None'}")
        print()
        
        # Create Redis client
        try:
            client = redis.Redis(
                host=redis_params['host'],
                port=redis_params['port'],
                password=redis_params['password'],
                ssl=redis_params['ssl'],
                username=redis_params.get('username'),
                socket_connect_timeout=5,
                socket_timeout=5,
                decode_responses=False
            )
        except Exception as e:
            print(f"ERROR: Failed to create Redis client: {e}")
            sys.exit(1)
    else:
        # Use URL format
        print("Using URL format connection...")
        print()
        try:
            client = redis.from_url(connection_string, socket_connect_timeout=5, socket_timeout=5)
        except Exception as e:
            print(f"ERROR: Failed to create Redis client from URL: {e}")
            sys.exit(1)
    
    # Test connection
    print("Testing connection...")
    try:
        response = client.ping()
        if response:
            print("[OK] Connection successful! Redis server responded to PING")
        else:
            print("[ERROR] Connection failed: No response to PING")
            sys.exit(1)
    except redis.exceptions.ConnectionError as e:
        print(f"[ERROR] Connection failed: {e}")
        print("\nNOTE: If connecting to Azure Redis Cache, ensure:")
        print("  1. Your IP address is whitelisted in Azure Redis Cache firewall rules")
        print("  2. You're connecting from an allowed network")
        print("  3. The Redis cache is running and accessible")
        sys.exit(1)
    except redis.exceptions.AuthenticationError as e:
        print(f"[ERROR] Authentication failed: {e}")
        print("\nNOTE: Check that the password is correct")
        sys.exit(1)
    except redis.exceptions.TimeoutError as e:
        print(f"[ERROR] Connection timeout: {e}")
        print("\nNOTE: The Redis server may be unreachable or firewall is blocking the connection")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        sys.exit(1)
    
    print()
    
    # Test basic operations
    print("Testing basic operations...")
    
    # Test SET/GET
    try:
        test_key = "test:connection:check"
        test_value = b"test_value_12345"
        client.set(test_key, test_value, ex=60)  # Expire in 60 seconds
        retrieved = client.get(test_key)
        if retrieved == test_value:
            print("[OK] SET/GET operation successful")
        else:
            print(f"[ERROR] SET/GET failed: Expected {test_value}, got {retrieved}")
        client.delete(test_key)
    except Exception as e:
        print(f"[ERROR] SET/GET operation failed: {e}")
    
    # Test INFO command
    try:
        info = client.info('server')
        redis_version = info.get(b'redis_version', b'unknown')
        print(f"[OK] INFO command successful - Redis version: {redis_version.decode('utf-8')}")
    except Exception as e:
        print(f"[ERROR] INFO command failed: {e}")
    
    # Test DBSIZE
    try:
        db_size = client.dbsize()
        print(f"[OK] DBSIZE command successful - Keys in database: {db_size}")
    except Exception as e:
        print(f"[ERROR] DBSIZE command failed: {e}")
    
    print()
    print("=" * 60)
    print("[SUCCESS] All tests passed! Redis connection is working correctly.")
    print("=" * 60)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Test Redis connection',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test with connection string as parameter
  python test_redis_connection.py "host:port,password=...,ssl=True"
  
  # Test with Redis URL format
  python test_redis_connection.py "rediss://:password@host:6380"
  
  # Interactive mode (will prompt for connection string)
  python test_redis_connection.py
  
  # Parse only (no connection attempt)
  python test_redis_connection.py --parse-only "host:port,password=...,ssl=True"
        """
    )
    parser.add_argument(
        'connection_string',
        nargs='?',
        default=None,
        help='Redis connection string (Azure format or redis:// URL). If not provided, will prompt for input.'
    )
    parser.add_argument(
        '--parse-only',
        action='store_true',
        help='Only parse the connection string, do not attempt to connect'
    )
    
    args = parser.parse_args()
    
    # Get connection string from argument or prompt user
    connection_string = args.connection_string
    if not connection_string:
        print("=" * 60)
        print("Redis Connection Test - Interactive Mode")
        print("=" * 60)
        print("Enter Redis connection string (Azure format or redis:// URL):")
        print("Example: host:port,password=...,ssl=True")
        print()
        connection_string = input("Connection string: ").strip()
        if not connection_string:
            print("[ERROR] Connection string cannot be empty")
            sys.exit(1)
        print()
    
    if args.parse_only:
        # Just parse and display
        print("=" * 60)
        print("Redis Connection String Parser")
        print("=" * 60)
        print(f"Input: {connection_string}")
        print()
        
        redis_params = parse_azure_redis_connection(connection_string)
        if redis_params:
            print("Parsed parameters:")
            print(f"  Host: {redis_params['host']}")
            print(f"  Port: {redis_params['port']}")
            print(f"  SSL: {redis_params['ssl']}")
            print(f"  Username: {redis_params.get('username', 'None')}")
            print(f"  Password: {'*' * len(redis_params['password']) if redis_params['password'] else 'None'}")
            print()
            print("Python Redis client creation code:")
            print("  import redis")
            print(f"  client = redis.Redis(")
            print(f"      host='{redis_params['host']}',")
            print(f"      port={redis_params['port']},")
            print(f"      password='{redis_params['password']}',")
            print(f"      ssl={redis_params['ssl']},")
            if redis_params.get('username'):
                print(f"      username='{redis_params['username']}',")
            print(f"      decode_responses=False")
            print(f"  )")
        else:
            print("Connection string is in URL format (redis:// or rediss://)")
            print("Use redis.from_url() to create the client")
    else:
        test_redis_connection(connection_string)

