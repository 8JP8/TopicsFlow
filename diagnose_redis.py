import os
import sys
import time
import redis
from dotenv import load_dotenv

# Load env vars
load_dotenv('backend/.env')

print("="*60)
print("REDIS DIAGNOSTIC TOOL")
print("="*60)

redis_url = os.getenv('REDIS_URL')
print(f"REDIS_URL provided: {'Yes' if redis_url else 'No'}")
if redis_url:
    # Obfuscate password for display
    safe_url = redis_url
    if 'password=' in safe_url:
        parts = safe_url.split(',')
        safe_parts = []
        for p in parts:
            if 'password=' in p.lower():
                safe_parts.append('password=****')
            else:
                safe_parts.append(p)
        safe_url = ','.join(safe_parts)
    print(f"Connection string: {safe_url}")

print(f"SESSION_TYPE: {os.getenv('SESSION_TYPE')}")
print("-" * 60)

def parse_azure_redis(value):
    if not value or '://' in value:
        return None
    parts = [p.strip() for p in value.split(',') if p.strip()]
    host_port = parts[0]
    password = None
    ssl = True
    for p in parts[1:]:
        if p.lower().startswith('password='):
            password = p.split('=', 1)[1]
        elif p.lower().startswith('ssl='):
            ssl = p.split('=', 1)[1].strip().lower() in ('true', '1', 'yes')
    
    if ':' in host_port:
        host, port = host_port.rsplit(':', 1)
        port = int(port)
    else:
        host = host_port
        port = 6380 if ssl else 6379
    
    return host, port, password, ssl

client = None
try:
    if redis_url and '://' not in redis_url:
        print("Parsing Azure-style connection string...")
        host, port, password, ssl = parse_azure_redis(redis_url)
        print(f"Host: {host}, Port: {port}, SSL: {ssl}")
        client = redis.Redis(
            host=host, 
            port=port, 
            password=password, 
            ssl=ssl, 
            socket_connect_timeout=5, 
            socket_timeout=5
        )
    elif redis_url:
        print("Using URL invocation...")
        client = redis.from_url(redis_url, socket_connect_timeout=5, socket_timeout=5)
    else:
        print("ERROR: No REDIS_URL found.")
        sys.exit(1)

    print("Attempting PING...")
    start = time.time()
    if client.ping():
        duration = (time.time() - start) * 1000
        print(f"SUCCESS: PING response received in {duration:.2f}ms")
    
    print("Attempting SET/GET...")
    client.set('diag_test', 'working', ex=60)
    val = client.get('diag_test')
    print(f"GET result: {val}")
    
    if val == b'working':
        print("SUCCESS: Read/Write verified.")
    else:
        print("ERROR: Read/Write failed.")

except Exception as e:
    print(f"\nCRITICAL ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("="*60)
print("Checking Config (Simulated)")
# Simulate config.py logic
is_azure = os.getenv('WEBSITE_INSTANCE_ID') is not None
print(f"IS_AZURE detected: {is_azure}")

redis_configured = is_azure or (os.getenv('SESSION_TYPE') == 'redis' and redis_url)
print(f"Should use Redis: {redis_configured}")

session_secure = is_azure or (os.getenv('ENVIRONMENT') == 'production')
print(f"SESSION_COOKIE_SECURE: {session_secure}")
print(f"SESSION_COOKIE_SAMESITE: {'None' if session_secure else 'Lax'}")

if session_secure and not is_azure:
    print("\nWARNING: Secure cookies are enabled but you might be on HTTP (Local).")
    print("This can cause the browser to reject cookies, preventing login.")
    print("Ensure ENVIRONMENT is not 'production' locally if not using HTTPS.")

print("="*60)
