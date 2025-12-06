"""
Database Migration Script
Updates database entries to match current schema, especially date fields.
"""
import sys
import os
from datetime import datetime
from bson import ObjectId

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pymongo import MongoClient
import importlib.util

# Load config
config_path = os.path.join(os.path.dirname(__file__), '..', 'config.py')
spec = importlib.util.spec_from_file_location("config_module", config_path)
config_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config_module)
config = config_module.config

def migrate_database():
    """Migrate database entries to current schema."""
    # Load configuration
    config_name = os.getenv('FLASK_ENV', 'default')
    app_config = config[config_name]
    
    # Connect to database
    mongo_options = {}
    is_azure = getattr(app_config, 'IS_AZURE', False)
    if is_azure:
        mongo_options = {
            'ssl': getattr(app_config, 'COSMOS_SSL', True),
            'retryWrites': getattr(app_config, 'COSMOS_RETRY_WRITES', False),
            'serverSelectionTimeoutMS': 30000,
            'connectTimeoutMS': 30000,
            'socketTimeoutMS': 30000,
        }
    
    mongo_uri = getattr(app_config, 'MONGO_URI', 'mongodb://localhost:27017/')
    mongo_db_name = getattr(app_config, 'MONGO_DB_NAME', 'topicsflow')
    
    client = MongoClient(mongo_uri, **mongo_options)
    db = client[mongo_db_name]
    
    print("=" * 60)
    print("Database Migration Script")
    print("=" * 60)
    print(f"Database: {mongo_db_name}")
    print(f"Mode: {'Azure CosmosDB' if is_azure else 'MongoDB'}")
    print("=" * 60)
    
    updates_made = 0
    
    # Migrate Topics
    print("\n[1/6] Migrating Topics...")
    topics_collection = db.topics
    topics = list(topics_collection.find({}))
    print(f"  Found {len(topics)} topics")
    
    for topic in topics:
        updates = {}
        
        # Ensure created_at is datetime
        if 'created_at' in topic:
            if isinstance(topic['created_at'], str):
                try:
                    updates['created_at'] = datetime.fromisoformat(topic['created_at'].replace('Z', '+00:00'))
                except:
                    updates['created_at'] = datetime.utcnow()
            elif not isinstance(topic['created_at'], datetime):
                updates['created_at'] = datetime.utcnow()
        
        # Ensure last_activity is datetime
        if 'last_activity' in topic:
            if isinstance(topic['last_activity'], str):
                try:
                    updates['last_activity'] = datetime.fromisoformat(topic['last_activity'].replace('Z', '+00:00'))
                except:
                    updates['last_activity'] = datetime.utcnow()
            elif not isinstance(topic['last_activity'], datetime):
                updates['last_activity'] = datetime.utcnow()
        
        # Add deleted_at, permanent_delete_at if topic is deleted
        if topic.get('is_deleted') and 'deleted_at' not in topic:
            updates['deleted_at'] = topic.get('created_at', datetime.utcnow())
            if isinstance(updates['deleted_at'], str):
                try:
                    updates['deleted_at'] = datetime.fromisoformat(updates['deleted_at'].replace('Z', '+00:00'))
                except:
                    updates['deleted_at'] = datetime.utcnow()
        
        if topic.get('is_deleted') and 'permanent_delete_at' not in topic:
            deleted_at = updates.get('deleted_at') or topic.get('deleted_at') or datetime.utcnow()
            if isinstance(deleted_at, str):
                try:
                    deleted_at = datetime.fromisoformat(deleted_at.replace('Z', '+00:00'))
                except:
                    deleted_at = datetime.utcnow()
            from datetime import timedelta
            updates['permanent_delete_at'] = deleted_at + timedelta(days=7)
        
        # Ensure deletion_status exists for deleted topics
        if topic.get('is_deleted') and 'deletion_status' not in topic:
            updates['deletion_status'] = 'pending'
        
        if updates:
            topics_collection.update_one({'_id': topic['_id']}, {'$set': updates})
            updates_made += 1
    
    print(f"  Updated {updates_made} topics")
    total_updates = updates_made
    updates_made = 0
    
    # Migrate Messages
    print("\n[2/6] Migrating Messages...")
    messages_collection = db.messages
    messages = list(messages_collection.find({}))
    print(f"  Found {len(messages)} messages")
    
    for message in messages:
        updates = {}
        
        # Ensure created_at is datetime
        if 'created_at' in message:
            if isinstance(message['created_at'], str):
                try:
                    updates['created_at'] = datetime.fromisoformat(message['created_at'].replace('Z', '+00:00'))
                except:
                    updates['created_at'] = datetime.utcnow()
            elif not isinstance(message['created_at'], datetime):
                updates['created_at'] = datetime.utcnow()
        
        # Ensure deleted_at is datetime
        if 'deleted_at' in message:
            if isinstance(message['deleted_at'], str):
                try:
                    updates['deleted_at'] = datetime.fromisoformat(message['deleted_at'].replace('Z', '+00:00'))
                except:
                    updates['deleted_at'] = datetime.utcnow()
            elif not isinstance(message['deleted_at'], datetime):
                updates['deleted_at'] = datetime.utcnow()
        
        # Ensure permanent_delete_at is datetime
        if 'permanent_delete_at' in message:
            if isinstance(message['permanent_delete_at'], str):
                try:
                    updates['permanent_delete_at'] = datetime.fromisoformat(message['permanent_delete_at'].replace('Z', '+00:00'))
                except:
                    if message.get('deleted_at'):
                        deleted_at = message['deleted_at']
                        if isinstance(deleted_at, str):
                            try:
                                deleted_at = datetime.fromisoformat(deleted_at.replace('Z', '+00:00'))
                            except:
                                deleted_at = datetime.utcnow()
                        from datetime import timedelta
                        updates['permanent_delete_at'] = deleted_at + timedelta(days=30)
                    else:
                        from datetime import timedelta
                        updates['permanent_delete_at'] = datetime.utcnow() + timedelta(days=30)
            elif not isinstance(message['permanent_delete_at'], datetime):
                if message.get('deleted_at'):
                    deleted_at = message['deleted_at']
                    if isinstance(deleted_at, str):
                        try:
                            deleted_at = datetime.fromisoformat(deleted_at.replace('Z', '+00:00'))
                        except:
                            deleted_at = datetime.utcnow()
                    from datetime import timedelta
                    updates['permanent_delete_at'] = deleted_at + timedelta(days=30)
                else:
                    from datetime import timedelta
                    updates['permanent_delete_at'] = datetime.utcnow() + timedelta(days=30)
        
        # Remove data field from attachments (should only have file_id and url)
        if 'attachments' in message and isinstance(message['attachments'], list):
            cleaned_attachments = []
            for att in message['attachments']:
                if isinstance(att, dict):
                    cleaned_att = {k: v for k, v in att.items() if k != 'data'}
                    cleaned_attachments.append(cleaned_att)
                else:
                    cleaned_attachments.append(att)
            if cleaned_attachments != message['attachments']:
                updates['attachments'] = cleaned_attachments
        
        if updates:
            messages_collection.update_one({'_id': message['_id']}, {'$set': updates})
            updates_made += 1
    
    print(f"  Updated {updates_made} messages")
    total_updates += updates_made
    updates_made = 0
    
    # Migrate Posts
    print("\n[3/6] Migrating Posts...")
    posts_collection = db.posts
    posts = list(posts_collection.find({}))
    print(f"  Found {len(posts)} posts")
    
    for post in posts:
        updates = {}
        
        # Ensure created_at is datetime
        if 'created_at' in post:
            if isinstance(post['created_at'], str):
                try:
                    updates['created_at'] = datetime.fromisoformat(post['created_at'].replace('Z', '+00:00'))
                except:
                    updates['created_at'] = datetime.utcnow()
            elif not isinstance(post['created_at'], datetime):
                updates['created_at'] = datetime.utcnow()
        
        # Ensure updated_at is datetime
        if 'updated_at' in post:
            if isinstance(post['updated_at'], str):
                try:
                    updates['updated_at'] = datetime.fromisoformat(post['updated_at'].replace('Z', '+00:00'))
                except:
                    updates['updated_at'] = datetime.utcnow()
            elif not isinstance(post['updated_at'], datetime):
                updates['updated_at'] = datetime.utcnow()
        
        # Ensure deleted_at is datetime
        if 'deleted_at' in post:
            if isinstance(post['deleted_at'], str):
                try:
                    updates['deleted_at'] = datetime.fromisoformat(post['deleted_at'].replace('Z', '+00:00'))
                except:
                    updates['deleted_at'] = datetime.utcnow()
            elif not isinstance(post['deleted_at'], datetime):
                updates['deleted_at'] = datetime.utcnow()
        
        # Add permanent_delete_at and deletion_status for owner deletions
        if post.get('is_deleted') and post.get('deleted_by'):
            # Check if owner deleted (deleted_by == user_id)
            if str(post.get('deleted_by')) == str(post.get('user_id')):
                if 'permanent_delete_at' not in post:
                    deleted_at = updates.get('deleted_at') or post.get('deleted_at') or datetime.utcnow()
                    if isinstance(deleted_at, str):
                        try:
                            deleted_at = datetime.fromisoformat(deleted_at.replace('Z', '+00:00'))
                        except:
                            deleted_at = datetime.utcnow()
                    from datetime import timedelta
                    updates['permanent_delete_at'] = deleted_at + timedelta(days=7)
                
                if 'deletion_status' not in post:
                    updates['deletion_status'] = 'pending'
        
        if updates:
            posts_collection.update_one({'_id': post['_id']}, {'$set': updates})
            updates_made += 1
    
    print(f"  Updated {updates_made} posts")
    total_updates += updates_made
    updates_made = 0
    
    # Migrate Chat Rooms
    print("\n[4/6] Migrating Chat Rooms...")
    chat_rooms_collection = db.chat_rooms
    chat_rooms = list(chat_rooms_collection.find({}))
    print(f"  Found {len(chat_rooms)} chat rooms")
    
    for room in chat_rooms:
        updates = {}
        
        # Ensure created_at is datetime
        if 'created_at' in room:
            if isinstance(room['created_at'], str):
                try:
                    updates['created_at'] = datetime.fromisoformat(room['created_at'].replace('Z', '+00:00'))
                except:
                    updates['created_at'] = datetime.utcnow()
            elif not isinstance(room['created_at'], datetime):
                updates['created_at'] = datetime.utcnow()
        
        # Ensure last_activity is datetime
        if 'last_activity' in room:
            if isinstance(room['last_activity'], str):
                try:
                    updates['last_activity'] = datetime.fromisoformat(room['last_activity'].replace('Z', '+00:00'))
                except:
                    updates['last_activity'] = datetime.utcnow()
            elif not isinstance(room['last_activity'], datetime):
                updates['last_activity'] = datetime.utcnow()
        
        # Add deleted_at, permanent_delete_at if room is deleted
        if room.get('is_deleted') and 'deleted_at' not in room:
            updates['deleted_at'] = room.get('created_at', datetime.utcnow())
            if isinstance(updates['deleted_at'], str):
                try:
                    updates['deleted_at'] = datetime.fromisoformat(updates['deleted_at'].replace('Z', '+00:00'))
                except:
                    updates['deleted_at'] = datetime.utcnow()
        
        if room.get('is_deleted') and 'permanent_delete_at' not in room:
            deleted_at = updates.get('deleted_at') or room.get('deleted_at') or datetime.utcnow()
            if isinstance(deleted_at, str):
                try:
                    deleted_at = datetime.fromisoformat(deleted_at.replace('Z', '+00:00'))
                except:
                    deleted_at = datetime.utcnow()
            from datetime import timedelta
            updates['permanent_delete_at'] = deleted_at + timedelta(days=7)
        
        # Ensure deletion_status exists for deleted rooms
        if room.get('is_deleted') and 'deletion_status' not in room:
            updates['deletion_status'] = 'pending'
        
        if updates:
            chat_rooms_collection.update_one({'_id': room['_id']}, {'$set': updates})
            updates_made += 1
    
    print(f"  Updated {updates_made} chat rooms")
    total_updates += updates_made
    updates_made = 0
    
    # Migrate Users
    print("\n[5/6] Migrating Users...")
    users_collection = db.users
    users = list(users_collection.find({}))
    print(f"  Found {len(users)} users")
    
    for user in users:
        updates = {}
        
        # Ensure created_at is datetime
        if 'created_at' in user:
            if isinstance(user['created_at'], str):
                try:
                    updates['created_at'] = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
                except:
                    updates['created_at'] = datetime.utcnow()
            elif not isinstance(user['created_at'], datetime):
                updates['created_at'] = datetime.utcnow()
        
        # Ensure updated_at is datetime
        if 'updated_at' in user:
            if isinstance(user['updated_at'], str):
                try:
                    updates['updated_at'] = datetime.fromisoformat(user['updated_at'].replace('Z', '+00:00'))
                except:
                    updates['updated_at'] = datetime.utcnow()
            elif not isinstance(user['updated_at'], datetime):
                updates['updated_at'] = datetime.utcnow()
        
        if updates:
            users_collection.update_one({'_id': user['_id']}, {'$set': updates})
            updates_made += 1
    
    print(f"  Updated {updates_made} users")
    total_updates += updates_made
    updates_made = 0
    
    # Migrate Comments
    print("\n[6/6] Migrating Comments...")
    comments_collection = db.comments
    comments = list(comments_collection.find({}))
    print(f"  Found {len(comments)} comments")
    
    for comment in comments:
        updates = {}
        
        # Ensure created_at is datetime
        if 'created_at' in comment:
            if isinstance(comment['created_at'], str):
                try:
                    updates['created_at'] = datetime.fromisoformat(comment['created_at'].replace('Z', '+00:00'))
                except:
                    updates['created_at'] = datetime.utcnow()
            elif not isinstance(comment['created_at'], datetime):
                updates['created_at'] = datetime.utcnow()
        
        # Ensure updated_at is datetime
        if 'updated_at' in comment:
            if isinstance(comment['updated_at'], str):
                try:
                    updates['updated_at'] = datetime.fromisoformat(comment['updated_at'].replace('Z', '+00:00'))
                except:
                    updates['updated_at'] = datetime.utcnow()
            elif not isinstance(comment['updated_at'], datetime):
                updates['updated_at'] = datetime.utcnow()
        
        if updates:
            comments_collection.update_one({'_id': comment['_id']}, {'$set': updates})
            updates_made += 1
    
    print(f"  Updated {updates_made} comments")
    total_updates += updates_made
    
    print("\n" + "=" * 60)
    print(f"Migration completed! Total updates: {total_updates}")
    print("=" * 60)
    
    client.close()

if __name__ == '__main__':
    try:
        migrate_database()
    except KeyboardInterrupt:
        print("\nMigration cancelled by user")
    except Exception as e:
        print(f"\nError during migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

