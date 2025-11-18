from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from bson import ObjectId


class ConversationSettings:
    """
    Model for managing conversation settings (mute, block, etc.)
    """
    
    def __init__(self, db):
        self.db = db
        self.collection = db.conversation_settings
    
    def mute_conversation(self, user_id: str, other_user_id: str, minutes: int) -> bool:
        """
        Mute a conversation for a specified duration.
        minutes: -1 means mute indefinitely until unmuted
        """
        try:
            mute_until = None
            if minutes > 0:
                mute_until = datetime.utcnow() + timedelta(minutes=minutes)
            
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'other_user_id': ObjectId(other_user_id)
                },
                {
                    '$set': {
                        'muted': True,
                        'muted_until': mute_until,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'other_user_id': ObjectId(other_user_id),
                        'blocked': False,
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error muting conversation: {str(e)}")
            return False
    
    def unmute_conversation(self, user_id: str, other_user_id: str) -> bool:
        """Unmute a conversation."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'other_user_id': ObjectId(other_user_id)
                },
                {
                    '$set': {
                        'muted': False,
                        'muted_until': None,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return True
        except Exception as e:
            print(f"Error unmuting conversation: {str(e)}")
            return False
    
    def is_muted(self, user_id: str, other_user_id: str) -> bool:
        """Check if a conversation is currently muted."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'other_user_id': ObjectId(other_user_id),
                'muted': True
            })
            
            if not settings:
                return False
            
            # Check if mute has expired
            if settings.get('muted_until'):
                if datetime.utcnow() > settings['muted_until']:
                    # Mute expired, unmute it
                    self.unmute_conversation(user_id, other_user_id)
                    return False
            
            return True
        except Exception as e:
            print(f"Error checking mute status: {str(e)}")
            return False
    
    def block_user(self, user_id: str, other_user_id: str) -> bool:
        """Block a user."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'other_user_id': ObjectId(other_user_id)
                },
                {
                    '$set': {
                        'blocked': True,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'other_user_id': ObjectId(other_user_id),
                        'muted': False,
                        'muted_until': None,
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error blocking user: {str(e)}")
            return False
    
    def unblock_user(self, user_id: str, other_user_id: str) -> bool:
        """Unblock a user."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'other_user_id': ObjectId(other_user_id)
                },
                {
                    '$set': {
                        'blocked': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return True
        except Exception as e:
            print(f"Error unblocking user: {str(e)}")
            return False
    
    def is_blocked(self, user_id: str, other_user_id: str) -> bool:
        """Check if a user is blocked."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'other_user_id': ObjectId(other_user_id),
                'blocked': True
            })
            return settings is not None
        except Exception as e:
            print(f"Error checking block status: {str(e)}")
            return False
    
    def get_settings(self, user_id: str, other_user_id: str) -> Optional[Dict[str, Any]]:
        """Get conversation settings."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'other_user_id': ObjectId(other_user_id)
            })
            
            if not settings:
                return {
                    'muted': False,
                    'blocked': False,
                    'muted_until': None
                }
            
            return {
                'muted': settings.get('muted', False),
                'blocked': settings.get('blocked', False),
                'muted_until': settings.get('muted_until'),
            }
        except Exception as e:
            print(f"Error getting settings: {str(e)}")
            return None

