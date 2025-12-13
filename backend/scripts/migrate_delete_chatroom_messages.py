#!/usr/bin/env python3
"""
Migration script to delete all chatroom messages from the database.

This script:
1. Connects to MongoDB using the same configuration as the app
2. Finds all messages where chat_room_id exists (not null)
3. Deletes all matching documents from the messages collection
4. Logs deletion count and provides confirmation

Usage:
    python backend/scripts/migrate_delete_chatroom_messages.py

Safety:
    - Requires confirmation before deletion
    - Logs all operations
    - Shows count before deletion
"""

import os
import sys
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# Add parent directory to path to import config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import config
import importlib.util
config_path = os.path.join(os.path.dirname(__file__), '..', 'config.py')
spec = importlib.util.spec_from_file_location("config_module", config_path)
config_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config_module)
config = config_module.config

def connect_to_database():
    """Connect to MongoDB using app configuration."""
    # Use default config
    app_config = config['default']()
    
    # Get MongoDB connection details
    mongo_uri = app_config.MONGO_URI
    db_name = app_config.MONGO_DB_NAME
    
    print(f"Connecting to MongoDB: {mongo_uri}")
    print(f"Database: {db_name}")
    
    # Connect to MongoDB
    mongo_options = {
        'serverSelectionTimeoutMS': 5000,
        'connectTimeoutMS': 30000,
    }
    
    if hasattr(app_config, 'COSMOS_SSL') and app_config.COSMOS_SSL:
        mongo_options['ssl'] = True
        mongo_options['retryWrites'] = False
    
    client = MongoClient(mongo_uri, **mongo_options)
    db = client[db_name]
    
    # Test connection
    try:
        client.admin.command('ping')
        print("✓ Successfully connected to MongoDB")
    except Exception as e:
        print(f"✗ Failed to connect to MongoDB: {e}")
        sys.exit(1)
    
    return db

def count_chatroom_messages(db):
    """Count messages with chat_room_id."""
    count = db.messages.count_documents({'chat_room_id': {'$exists': True, '$ne': None}})
    return count

def delete_chatroom_messages(db, dry_run=False):
    """Delete all messages with chat_room_id."""
    query = {'chat_room_id': {'$exists': True, '$ne': None}}
    
    if dry_run:
        print("\n[DRY RUN] Would delete messages matching query:")
        print(f"  Query: {query}")
        count = count_chatroom_messages(db)
        print(f"  Count: {count} messages")
        return count
    
    # Delete all matching messages
    result = db.messages.delete_many(query)
    return result.deleted_count

def main():
    """Main migration function."""
    print("=" * 60)
    print("Chatroom Messages Deletion Migration Script")
    print("=" * 60)
    print()
    
    # Connect to database
    db = connect_to_database()
    
    # Count messages to be deleted
    print("\nCounting chatroom messages...")
    count = count_chatroom_messages(db)
    print(f"Found {count} messages with chat_room_id")
    
    if count == 0:
        print("\n✓ No chatroom messages found. Nothing to delete.")
        return
    
    # Show sample messages
    print("\nSample messages to be deleted:")
    sample = list(db.messages.find({'chat_room_id': {'$exists': True, '$ne': None}}).limit(5))
    for msg in sample:
        msg_id = str(msg.get('_id', 'Unknown'))
        chat_room_id = str(msg.get('chat_room_id', 'Unknown'))
        content_preview = msg.get('content', '')[:50] if msg.get('content') else '[No content]'
        created_at = msg.get('created_at', 'Unknown')
        print(f"  - ID: {msg_id}, Chat Room: {chat_room_id}, Content: {content_preview}..., Created: {created_at}")
    
    if len(sample) < count:
        print(f"  ... and {count - len(sample)} more")
    
    # Confirm deletion
    print("\n" + "=" * 60)
    print("WARNING: This will permanently delete all chatroom messages!")
    print("=" * 60)
    response = input(f"\nAre you sure you want to delete {count} messages? (yes/no): ")
    
    if response.lower() not in ['yes', 'y']:
        print("\n✗ Deletion cancelled.")
        return
    
    # Perform deletion
    print("\nDeleting chatroom messages...")
    deleted_count = delete_chatroom_messages(db, dry_run=False)
    
    print(f"\n✓ Successfully deleted {deleted_count} messages")
    
    # Verify deletion
    remaining = count_chatroom_messages(db)
    if remaining == 0:
        print("✓ Verification: All chatroom messages have been deleted")
    else:
        print(f"⚠ Warning: {remaining} chatroom messages still remain")
    
    print("\n" + "=" * 60)
    print("Migration completed!")
    print("=" * 60)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)





