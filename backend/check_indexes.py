
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config import Config
except ImportError:
    # Fallback if config.py has dependencies we can't satisfy easily
    class Config:
        MONGO_URI = None
        MONGO_DBNAME = 'topicsflow'
if not os.environ.get('WEBSITE_SITE_NAME'):
    # Try to load from .env or just assume connection string is set
    pass

def check_indexes():
    # Get URI - support both env var names
    uri = os.environ.get('AZURE_COSMOS_CONNECTIONSTRING') or os.environ.get('COSMOS_DB_URI') or Config.MONGO_URI
    
    if not uri:
        print("❌ No connection string found (AZURE_COSMOS_CONNECTIONSTRING or COSMOS_DB_URI)")
        return

    print(f"Connecting to: {uri.split('@')[-1] if '@' in uri else '...'}") # hide credentials

    try:
        client = pymongo.MongoClient(uri)
        db = client[Config.MONGO_DBNAME]
        
        print(f"\nChecking collection: users")
        if "users" not in db.list_collection_names():
            print("❌ Collection 'users' DOES NOT EXIST.")
            return

        indexes = list(db.users.list_indexes())
        print(f"Found {len(indexes)} indexes:")
        
        unique_username = False
        unique_email = False
        
        for idx in indexes:
            print(f" - Name: {idx['name']}")
            print(f"   Key: {idx['key']}")
            print(f"   Unique: {idx.get('unique', False)}")
            print("   ---")
            
            # Check for our critical unique indexes
            if idx['key'].get('username') and idx.get('unique'):
                unique_username = True
            if idx['key'].get('email') and idx.get('unique'):
                unique_email = True

        if unique_username and unique_email:
            print("\n✅ SUCCESS: Both 'username' and 'email' unique indexes EXIST.")
            print("The warnings in logs are likely due to race conditions between workers. You can ignore them.")
        else:
            print("\n❌ FAILURE: Missing unique indexes.")
            if not unique_username: print(" - Missing unique 'username'")
            if not unique_email: print(" - Missing unique 'email'")
            print("Something else must have created the collection before index creation ran.")

    except Exception as e:
        print(f"❌ Error checking indexes: {e}")

if __name__ == "__main__":
    check_indexes()
