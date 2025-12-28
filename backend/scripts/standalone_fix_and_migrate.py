import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

def standalone_fix():
    print("Loading environment...")
    load_dotenv()
    
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/topicsflow')
    # Extract DB name from URI
    # Handle cases like mongodb://user:pass@host:port/dbname?options
    parts = mongo_uri.split('/')
    last_part = parts[-1]
    db_name = last_part.split('?')[0]
    
    if not db_name:
        # Fallback if URI doesn't end with /dbname
        db_name = 'topicsflow'

    print(f"Connecting to MongoDB at {mongo_uri} (DB: {db_name})...")
    client = MongoClient(mongo_uri)
    db = client[db_name]
    
    print("Dropping all indexes from conversation_settings to avoid conflicts...")
    try:
        db.conversation_settings.drop_indexes()
        print("Dropped conversation_settings indexes.")
    except Exception as e:
        print(f"Error dropping conversation_settings indexes: {e}")

    print("Dropping all indexes from notification_settings to avoid conflicts...")
    try:
        db.notification_settings.drop_indexes()
        print("Dropped notification_settings indexes.")
    except Exception as e:
        print(f"Error dropping notification_settings indexes: {e}")

    print("\nStarting migration manually (standalone style)...")
    conv_settings = list(db.conversation_settings.find({}))
    migrated_count = 0
    
    for setting in conv_settings:
        try:
            user_id = setting.get('user_id')
            if not user_id: continue
            
            target_query = {'user_id': user_id}
            target_update = {
                '$set': {
                    'muted': setting.get('muted', False),
                    'muted_until': setting.get('muted_until'),
                    'updated_at': datetime.utcnow()
                },
                '$setOnInsert': {
                    'created_at': setting.get('created_at', datetime.utcnow())
                }
            }
            
            if 'other_user_id' in setting:
                target_query.update({'other_user_id': setting['other_user_id'], 'type': 'private_message'})
                target_update['$setOnInsert']['type'] = 'private_message'
                target_update['$set']['blocked'] = setting.get('blocked', False)
            elif 'topic_id' in setting and setting.get('type') == 'topic':
                target_query.update({'topic_id': setting['topic_id'], 'type': 'topic'})
                target_update['$setOnInsert']['type'] = 'topic'
            elif 'chat_room_id' in setting and setting.get('type') == 'chat_room':
                target_query.update({'chat_room_id': setting['chat_room_id'], 'type': 'chat_room'})
                target_update['$setOnInsert']['type'] = 'chat_room'
                target_update['$setOnInsert']['following'] = True
            else:
                continue
                
            db.notification_settings.update_one(target_query, target_update, upsert=True)
            migrated_count += 1
        except Exception as e:
            print(f"Error migrating setting {setting.get('_id')}: {e}")
            
    print(f"\nMigration finished: {migrated_count} documents processed.")
    print("Now you can restart the backend, and app.py will create the NEW indexes correctly.")

if __name__ == "__main__":
    standalone_fix()
