#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to clear test data from MongoDB before running tests.
Removes test users and related data to ensure clean test environment.
"""
import os
import sys
import io

# Fix Windows console encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def clear_test_data():
    """Clear test users and related data from database."""
    try:
        # Get MongoDB connection from environment or use default
        mongo_uri = os.getenv('DATABASE_URL', 'mongodb://localhost:27017/chatapp')
        db_name = os.getenv('DB_NAME', 'chatapp')
        
        # Parse connection string
        if '/' in mongo_uri:
            # Format: mongodb://host:port/dbname
            parts = mongo_uri.rsplit('/', 1)
            if len(parts) == 2:
                mongo_uri = parts[0]
                db_name = parts[1] if parts[1] else db_name
        
        print(f"Connecting to MongoDB: {mongo_uri}")
        print(f"Database: {db_name}")
        
        client = MongoClient(mongo_uri)
        db = client[db_name]
        
        # Test users to remove
        test_usernames = ['testuser1', 'testuser2']
        test_emails = ['test1@example.com', 'test2@example.com']
        
        # Also check for users with patterns (in case of timestamped usernames)
        test_patterns = ['testuser1_', 'testuser2_', 'test1_', 'test2_']
        
        print("\nClearing test data...")
        
        # Remove test users
        users_removed = 0
        for username in test_usernames:
            result = db.users.delete_many({'username': username})
            users_removed += result.deleted_count
            if result.deleted_count > 0:
                print(f"  [OK] Removed user: {username}")
        
        for email in test_emails:
            result = db.users.delete_many({'email': email})
            users_removed += result.deleted_count
            if result.deleted_count > 0:
                print(f"  [OK] Removed user with email: {email}")
        
        # Remove users matching patterns
        for pattern in test_patterns:
            result = db.users.delete_many({'username': {'$regex': f'^{pattern}'}})
            users_removed += result.deleted_count
            if result.deleted_count > 0:
                print(f"  [OK] Removed {result.deleted_count} user(s) matching pattern: {pattern}*")
        
        # Remove test topics (optional - comment out if you want to keep topics)
        # topics_removed = db.topics.delete_many({'title': {'$regex': '^Test'}}).deleted_count
        # if topics_removed > 0:
        #     print(f"  ✓ Removed {topics_removed} test topic(s)")
        
        # Remove test messages from test users
        if users_removed > 0:
            # Get remaining test user IDs to clean up messages
            test_user_ids = []
            for username in test_usernames:
                user = db.users.find_one({'username': username})
                if user:
                    test_user_ids.append(user['_id'])
            
            if test_user_ids:
                messages_removed = db.messages.delete_many({'user_id': {'$in': test_user_ids}}).deleted_count
                if messages_removed > 0:
                    print(f"  [OK] Removed {messages_removed} test message(s)")
                
                private_messages_removed = db.private_messages.delete_many({
                    '$or': [
                        {'from_user_id': {'$in': test_user_ids}},
                        {'to_user_id': {'$in': test_user_ids}}
                    ]
                }).deleted_count
                if private_messages_removed > 0:
                    print(f"  [OK] Removed {private_messages_removed} test private message(s)")
        
        print(f"\n[SUCCESS] Test data cleared successfully!")
        print(f"  Total users removed: {users_removed}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"\n[ERROR] Error clearing test data: {str(e)}")
        print("  Make sure MongoDB is running and accessible.")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("ChatHub Test Data Cleaner")
    print("=" * 60)
    
    success = clear_test_data()
    
    if success:
        print("\n[SUCCESS] Database is ready for testing!")
        sys.exit(0)
    else:
        print("\n[ERROR] Failed to clear test data. Please check MongoDB connection.")
        sys.exit(1)

