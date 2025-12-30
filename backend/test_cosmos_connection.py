
import sys
import pymongo
from pymongo import MongoClient
import ssl

def test_connection(uri):
    print(f"Testing connection to: {uri.split('@')[-1]}") # Hide credentials
    try:
        # Cosmos DB requires SSL and specific timeout settings
        client = MongoClient(uri, 
                             ssl=True,
                             serverSelectionTimeoutMS=5000,
                             connectTimeoutMS=5000,
                             socketTimeoutMS=5000)
        
        print("Attempting to ping server...")
        # The ismaster command is cheap and does not require auth.
        client.admin.command('ismaster')
        print("✅ Connection successful!")
        
        print(f"Server info: {client.server_info()}")
        
    except pymongo.errors.ServerSelectionTimeoutError as e:
        print(f"❌ Connection failed: Timeout")
        print(f"Details: {e}")
    except pymongo.errors.OperationFailure as e:
        print(f"❌ Connection failed: Authentication or Permission Error")
        print(f"Details: {e}")
    except pymongo.errors.ConfigurationError as e:
        print(f"❌ Connection failed: Configuration Error (Likely Protocol Mismatch)")
        print(f"Details: {e}")
    except Exception as e:
        print(f"❌ Connection failed: {type(e).__name__}")
        print(f"Details: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        uri = sys.argv[1]
        test_connection(uri)
    else:
        print("Usage: python test_cosmos_connection.py <mongodb_uri>")
