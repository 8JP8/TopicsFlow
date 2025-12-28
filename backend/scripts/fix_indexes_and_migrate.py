import sys
import os
from pymongo import MongoClient
from bson import ObjectId

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app

def fix_indexes_and_migrate():
    app = create_app()
    db = app.db
    
    print("Fixing indexes for conversation_settings...")
    try:
        # Drop all indexes except _id
        db.conversation_settings.drop_indexes()
        # They will be recreated by create_db_indexes if we call it, 
        # but create_app already calls it. Wait, create_app calls it.
        # So we should drop them BEFORE calling create_app? 
        # Or just drop and call create_db_indexes manually.
    except Exception as e:
        print(f"Error dropping conversation_settings indexes: {e}")

    print("Fixing indexes for notification_settings...")
    try:
        db.notification_settings.drop_indexes()
    except Exception as e:
        print(f"Error dropping notification_settings indexes: {e}")

    # Now manually recreate them using the logic from app.py
    from app import create_db_indexes
    create_db_indexes(app)
    print("Indexes recreated successfully.")

    # Now run migration
    from models.notification_settings import NotificationSettings
    settings_model = NotificationSettings(db)
    print("Starting data migration...")
    count = settings_model.migrate_from_conversation_settings()
    print(f"Migration completed. Migrated {count} settings.")

if __name__ == "__main__":
    # We can't use create_app() directly if it fails due to index conflict.
    # So we'll connect directly first to drop indexes.
    from flask import Flask
    from dotenv import load_dotenv
    load_dotenv()
    
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/topicsflow')
    db_name = mongo_uri.split('/')[-1].split('?')[0]
    client = MongoClient(mongo_uri)
    db = client[db_name]
    
    print(f"Connected to {db_name}. Dropping conflicting indexes...")
    try:
        db.conversation_settings.drop_indexes()
        db.notification_settings.drop_indexes()
        print("Dropped indexes.")
    except Exception as e:
        print(f"Error dropping indexes: {e}")
    
    # Now it should be safe to run the full fix
    fix_indexes_and_migrate()
