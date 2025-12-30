
import sys
import os
import flask_session
import inspect

print(f"Python version: {sys.version}")
print(f"Flask-Session version: {getattr(flask_session, '__version__', 'unknown')}")
print(f"Flask-Session file: {flask_session.__file__}")

print("\n--- Top level attributes ---")
for name in dir(flask_session):
    if not name.startswith("_"):
        val = getattr(flask_session, name)
        print(f"{name}: {type(val)}")

print("\n--- Submodules check ---")
try:
    from flask_session import sessions
    print("Successfully imported flask_session.sessions")
    print(f"Attributes in sessions: {dir(sessions)}")
except ImportError as e:
    print(f"Failed to import flask_session.sessions: {e}")

try:
    from flask_session import redis
    print("Successfully imported flask_session.redis")
except ImportError as e:
    print(f"Failed to import flask_session.redis: {e}")

try:
    from flask_session import filesystem
    print("Successfully imported flask_session.filesystem")
except ImportError as e:
    print(f"Failed to import flask_session.filesystem: {e}")
    
# Check for the interfaces we need
print("\n--- Interface Search ---")
interfaces = ['RedisSessionInterface', 'FileSystemSessionInterface', 'SessionInterface']
found = {}

def check_module(mod, path_name):
    for interface in interfaces:
        if hasattr(mod, interface):
            print(f"FOUND {interface} in {path_name}")
            found[interface] = path_name

check_module(flask_session, "flask_session")
if 'sessions' in locals():
    check_module(sessions, "flask_session.sessions")

if not found:
    print("CRITICAL: Could not find SessionInterfaces in standard locations.")
else:
    print(f"Found interfaces: {found}")
