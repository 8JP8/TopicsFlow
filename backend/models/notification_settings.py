from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List
from bson import ObjectId


class NotificationSettings:
    """
    Model for managing notification settings for posts, chatrooms, topics, and private messages.
    Handles following, muting, and notification preferences.
    """

    def __init__(self, db):
        self.db = db
        self.collection = db.notification_settings
    
    def follow_post(self, user_id: str, post_id: str) -> bool:
        """Follow a post to receive notifications for new comments."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'post_id': ObjectId(post_id),
                    'type': 'post'
                },
                {
                    '$set': {
                        'following': True,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'post_id': ObjectId(post_id),
                        'type': 'post',
                        'muted': False,
                        'muted_until': None,
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error following post: {str(e)}")
            return False
    
    def unfollow_post(self, user_id: str, post_id: str) -> bool:
        """Unfollow a post."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'post_id': ObjectId(post_id),
                    'type': 'post'
                },
                {
                    '$set': {
                        'following': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return True
        except Exception as e:
            print(f"Error unfollowing post: {str(e)}")
            return False
    
    def is_following_post(self, user_id: str, post_id: str) -> bool:
        """Check if user is following a post."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'post_id': ObjectId(post_id),
                'type': 'post',
                'following': True
            })
            return settings is not None
        except Exception as e:
            print(f"Error checking post follow status: {str(e)}")
            return False
    
    def get_post_followers(self, post_id: str) -> list:
        """Get all users following a post."""
        try:
            followers = list(self.collection.find({
                'post_id': ObjectId(post_id),
                'type': 'post',
                'following': True
            }))
            return [str(f['user_id']) for f in followers]
        except Exception as e:
            print(f"Error getting post followers: {str(e)}")
            return []
    
    def follow_chat_room(self, user_id: str, chat_room_id: str) -> bool:
        """Follow a chat room to receive notifications for new messages."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'chat_room_id': ObjectId(chat_room_id),
                    'type': 'chat_room'
                },
                {
                    '$set': {
                        'following': True,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'chat_room_id': ObjectId(chat_room_id),
                        'type': 'chat_room',
                        'muted': False,
                        'muted_until': None,
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error following chat room: {str(e)}")
            return False

    def unfollow_chat_room(self, user_id: str, chat_room_id: str) -> bool:
        """Unfollow a chat room."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'chat_room_id': ObjectId(chat_room_id),
                    'type': 'chat_room'
                },
                {
                    '$set': {
                        'following': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return True
        except Exception as e:
            print(f"Error unfollowing chat room: {str(e)}")
            return False

    def is_following_chat_room(self, user_id: str, chat_room_id: str) -> bool:
        """Check if user is following a chat room. Defaults to True if no settings exist (for backward compatibility)."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'chat_room_id': ObjectId(chat_room_id),
                'type': 'chat_room'
            })
            
            # If no settings exist, default to following (backward compatibility)
            if not settings:
                return True
            
            # Return the following status
            return settings.get('following', True)  # Default to True if not explicitly set
        except Exception as e:
            print(f"Error checking chat room follow status: {str(e)}")
            return True  # Default to True on error
    
    def mute_topic(self, user_id: str, topic_id: str, minutes: int) -> bool:
        """
        Mute a topic for a specified duration.
        minutes: -1 means mute indefinitely, > 0 means mute for N minutes, 0 means unmute
        """
        try:
            if minutes == 0:
                return self.unmute_topic(user_id, topic_id)

            mute_until = None
            if minutes > 0:
                mute_until = datetime.utcnow() + timedelta(minutes=minutes)

            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id),
                    'type': 'topic'
                },
                {
                    '$set': {
                        'muted': True,
                        'muted_until': mute_until,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': ObjectId(topic_id),
                        'type': 'topic',
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error muting topic: {str(e)}")
            return False

    def unmute_topic(self, user_id: str, topic_id: str) -> bool:
        """Unmute a topic."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id),
                    'type': 'topic'
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
            print(f"Error unmuting topic: {str(e)}")
            return False

    def is_topic_muted(self, user_id: str, topic_id: str) -> bool:
        """Check if a topic is currently muted."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'type': 'topic',
                'muted': True
            })

            if not settings:
                return False

            if settings.get('muted_until'):
                if datetime.utcnow() > settings['muted_until']:
                    self.unmute_topic(user_id, topic_id)
                    return False

            return True
        except Exception as e:
            print(f"Error checking topic mute status: {str(e)}")
            return False

    def mute_chat_room(self, user_id: str, chat_room_id: str, minutes: int) -> bool:
        """Mute a chat room for a specified duration."""
        try:
            if minutes == 0:
                return self.unmute_chat_room(user_id, chat_room_id)

            mute_until = None
            if minutes > 0:
                mute_until = datetime.utcnow() + timedelta(minutes=minutes)

            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'chat_room_id': ObjectId(chat_room_id),
                    'type': 'chat_room'
                },
                {
                    '$set': {
                        'muted': True,
                        'muted_until': mute_until,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'chat_room_id': ObjectId(chat_room_id),
                        'type': 'chat_room',
                        'following': True,
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error muting chat room: {str(e)}")
            return False

    def unmute_chat_room(self, user_id: str, chat_room_id: str) -> bool:
        """Unmute a chat room."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'chat_room_id': ObjectId(chat_room_id),
                    'type': 'chat_room'
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
            print(f"Error unmuting chat room: {str(e)}")
            return False

    def is_chat_room_muted(self, user_id: str, chat_room_id: str) -> bool:
        """Check if a chat room is currently muted."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'chat_room_id': ObjectId(chat_room_id),
                'type': 'chat_room',
                'muted': True
            })

            if not settings:
                return False

            if settings.get('muted_until'):
                if datetime.utcnow() > settings['muted_until']:
                    self.unmute_chat_room(user_id, chat_room_id)
                    return False

            return True
        except Exception as e:
            print(f"Error checking chat room mute status: {str(e)}")
            return False

    def mute_post(self, user_id: str, post_id: str, minutes: int) -> bool:
        """Mute a post for a specified duration."""
        try:
            if minutes == 0:
                return self.unmute_post(user_id, post_id)

            mute_until = None
            if minutes > 0:
                mute_until = datetime.utcnow() + timedelta(minutes=minutes)

            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'post_id': ObjectId(post_id),
                    'type': 'post'
                },
                {
                    '$set': {
                        'muted': True,
                        'muted_until': mute_until,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'post_id': ObjectId(post_id),
                        'type': 'post',
                        'following': True,
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error muting post: {str(e)}")
            return False

    def unmute_post(self, user_id: str, post_id: str) -> bool:
        """Unmute a post."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'post_id': ObjectId(post_id),
                    'type': 'post'
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
            print(f"Error unmuting post: {str(e)}")
            return False

    def is_post_muted(self, user_id: str, post_id: str) -> bool:
        """Check if a post is currently muted."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'post_id': ObjectId(post_id),
                'type': 'post',
                'muted': True
            })

            if not settings:
                return False

            if settings.get('muted_until'):
                if datetime.utcnow() > settings['muted_until']:
                    self.unmute_post(user_id, post_id)
                    return False

            return True
        except Exception as e:
            print(f"Error checking post mute status: {str(e)}")
            return False

    def mute_private_message(self, user_id: str, other_user_id: str, minutes: int) -> bool:
        """Mute a private message conversation."""
        try:
            if minutes == 0:
                return self.unmute_private_message(user_id, other_user_id)

            mute_until = None
            if minutes > 0:
                mute_until = datetime.utcnow() + timedelta(minutes=minutes)

            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'other_user_id': ObjectId(other_user_id),
                    'type': 'private_message'
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
                        'type': 'private_message',
                        'blocked': False,
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error muting private message: {str(e)}")
            return False

    def unmute_private_message(self, user_id: str, other_user_id: str) -> bool:
        """Unmute a private message conversation."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'other_user_id': ObjectId(other_user_id),
                    'type': 'private_message'
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
            print(f"Error unmuting private message: {str(e)}")
            return False

    def is_private_message_muted(self, user_id: str, other_user_id: str) -> bool:
        """Check if a private message conversation is currently muted."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'other_user_id': ObjectId(other_user_id),
                'type': 'private_message',
                'muted': True
            })

            if not settings:
                return False

            if settings.get('muted_until'):
                if datetime.utcnow() > settings['muted_until']:
                    self.unmute_private_message(user_id, other_user_id)
                    return False

            return True
        except Exception as e:
            print(f"Error checking private message mute status: {str(e)}")
            return False

    def block_user(self, user_id: str, other_user_id: str) -> bool:
        """Block a user."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'other_user_id': ObjectId(other_user_id),
                    'type': 'private_message'
                },
                {
                    '$set': {
                        'blocked': True,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'other_user_id': ObjectId(other_user_id),
                        'type': 'private_message',
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
                    'other_user_id': ObjectId(other_user_id),
                    'type': 'private_message'
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

    def is_user_blocked(self, user_id: str, other_user_id: str) -> bool:
        """Check if a user is blocked."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'other_user_id': ObjectId(other_user_id),
                'type': 'private_message',
                'blocked': True
            })
            return settings is not None
        except Exception as e:
            print(f"Error checking block status: {str(e)}")
            return False

    def get_followed_posts(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all posts that a user is following."""
        try:
            followed = list(self.collection.find({
                'user_id': ObjectId(user_id),
                'type': 'post',
                'following': True
            }))
            
            result = []
            for item in followed:
                result.append({
                    'post_id': str(item.get('post_id')),
                    'created_at': item.get('created_at').isoformat() if item.get('created_at') else None
                })
            return result
        except Exception as e:
            print(f"Error getting followed posts: {str(e)}")
            return []

    def get_followed_chatrooms(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all chatrooms that a user is following."""
        try:
            followed = list(self.collection.find({
                'user_id': ObjectId(user_id),
                'type': 'chat_room',
                'following': True
            }))
            
            result = []
            for item in followed:
                result.append({
                    'chat_room_id': str(item.get('chat_room_id')),
                    'created_at': item.get('created_at').isoformat() if item.get('created_at') else None
                })
            return result
        except Exception as e:
            print(f"Error getting followed chatrooms: {str(e)}")
            return []

    def get_settings(self, user_id: str, entity_type: str, entity_id: str) -> Optional[Dict[str, Any]]:
        """Get notification settings for a specific entity."""
        try:
            query = {
                'user_id': ObjectId(user_id),
                'type': entity_type
            }
            
            if entity_type == 'post':
                query['post_id'] = ObjectId(entity_id)
            elif entity_type == 'chat_room':
                query['chat_room_id'] = ObjectId(entity_id)
            elif entity_type == 'topic':
                query['topic_id'] = ObjectId(entity_id)
            elif entity_type == 'private_message':
                query['other_user_id'] = ObjectId(entity_id)
            else:
                return None

            settings = self.collection.find_one(query)

            if not settings:
                return {
                    'following': False,
                    'muted': False,
                    'muted_until': None,
                    'blocked': False
                }

            return {
                'following': settings.get('following', False),
                'muted': settings.get('muted', False),
                'muted_until': settings.get('muted_until'),
                'blocked': settings.get('blocked', False),
            }
        except Exception as e:
            print(f"Error getting settings: {str(e)}")
            return None

    def migrate_from_conversation_settings(self) -> int:
        """
        Migrate data from conversation_settings collection to notification_settings.
        """
        try:
            conv_coll = self.db.conversation_settings
            all_settings = list(conv_coll.find({}))
            migrated_count = 0
            
            for setting in all_settings:
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
                        
                    self.collection.update_one(target_query, target_update, upsert=True)
                    migrated_count += 1
                except Exception as e:
                    print(f"Error migrating setting {setting.get('_id')}: {str(e)}")
                    continue
            
            return migrated_count
        except Exception as e:
            print(f"Error during migration: {str(e)}")
            return 0

