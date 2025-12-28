import sys
import os
from datetime import datetime, timedelta
from bson import ObjectId

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.notification_settings import NotificationSettings

def test_mute_logic():
    app = create_app()
    with app.app_context():
        db = app.db
        settings_model = NotificationSettings(db)
        
        user_id = str(ObjectId())
        topic_id = str(ObjectId())
        chat_room_id = str(ObjectId())
        post_id = str(ObjectId())
        other_user_id = str(ObjectId())
        
        print(f"--- Testing for User: {user_id} ---")
        
        # 1. Topic Mute
        print("\nTesting Topic Mute...")
        settings_model.mute_topic(user_id, topic_id, 30)
        is_muted = settings_model.is_topic_muted(user_id, topic_id)
        print(f"Topic muted for 30 mins: {is_muted} (Expected: True)")
        
        settings_model.mute_topic(user_id, topic_id, 0) # Unmute
        is_muted = settings_model.is_topic_muted(user_id, topic_id)
        print(f"Topic unmuted (0 mins): {is_muted} (Expected: False)")
        
        # 2. Chat Room Mute
        print("\nTesting Chat Room Mute...")
        settings_model.mute_chat_room(user_id, chat_room_id, 60)
        is_muted = settings_model.is_chat_room_muted(user_id, chat_room_id)
        print(f"Chat room muted for 60 mins: {is_muted} (Expected: True)")
        
        settings_model.unmute_chat_room(user_id, chat_room_id)
        is_muted = settings_model.is_chat_room_muted(user_id, chat_room_id)
        print(f"Chat room unmuted: {is_muted} (Expected: False)")
        
        # 3. Post Mute
        print("\nTesting Post Mute...")
        settings_model.mute_post(user_id, post_id, 120)
        is_muted = settings_model.is_post_muted(user_id, post_id)
        print(f"Post muted for 120 mins: {is_muted} (Expected: True)")
        
        settings_model.unmute_post(user_id, post_id)
        is_muted = settings_model.is_post_muted(user_id, post_id)
        print(f"Post unmuted: {is_muted} (Expected: False)")
        
        # 4. User Block
        print("\nTesting User Block...")
        settings_model.block_user(user_id, other_user_id)
        is_blocked = settings_model.is_user_blocked(user_id, other_user_id)
        print(f"User blocked: {is_blocked} (Expected: True)")
        
        settings_model.unblock_user(user_id, other_user_id)
        is_blocked = settings_model.is_user_blocked(user_id, other_user_id)
        print(f"User unblocked: {is_blocked} (Expected: False)")
        
        # 5. Migration Verification (Simulated)
        print("\nTesting Migration Data Mapping...")
        # Insert a raw conversation_setting
        old_topic_id = ObjectId()
        db.conversation_settings.insert_one({
            'user_id': ObjectId(user_id),
            'topic_id': old_topic_id,
            'type': 'topic',
            'muted': True,
            'muted_until': datetime.utcnow() + timedelta(minutes=10),
            'created_at': datetime.utcnow()
        })
        
        settings_model.migrate_from_conversation_settings()
        migrated = db.notification_settings.find_one({
            'user_id': ObjectId(user_id),
            'topic_id': old_topic_id,
            'type': 'topic'
        })
        print(f"Migrated setting found: {bool(migrated)} (Expected: True)")
        if migrated:
            print(f"Migrated muted status: {migrated.get('muted')} (Expected: True)")

        # Cleanup test data
        db.notification_settings.delete_many({'user_id': ObjectId(user_id)})
        db.conversation_settings.delete_many({'user_id': ObjectId(user_id)})
        print("\nTest data cleaned up.")

if __name__ == "__main__":
    test_mute_logic()
