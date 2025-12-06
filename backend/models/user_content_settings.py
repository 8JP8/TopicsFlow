from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class UserContentSettings:
    """
    Model for managing user content settings (silence, hide) for topics, posts, and chats.
    Implements hierarchical silencing where silencing a topic silences all content inside.
    """

    def __init__(self, db):
        self.db = db
        self.collection = db.user_content_settings

    def silence_topic(self, user_id: str, topic_id: str) -> bool:
        """Silence a topic (silences all posts and chats inside)."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$set': {
                        'silenced': True,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': ObjectId(topic_id),
                        'hidden': False,
                        'silenced_posts': [],
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error silencing topic: {str(e)}")
            return False

    def unsilence_topic(self, user_id: str, topic_id: str) -> bool:
        """Unsilence a topic."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$set': {
                        'silenced': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unsilencing topic: {str(e)}")
            return False

    def silence_post(self, user_id: str, post_id: str, topic_id: str) -> bool:
        """Silence a specific post."""
        try:
            # Check if topic is silenced
            topic_settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'silenced': True
            })
            
            if topic_settings:
                # Topic is silenced, so post is automatically silenced
                return True

            # Add post to silenced list
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$addToSet': {'silenced_posts': ObjectId(post_id)},
                    '$set': {'updated_at': datetime.utcnow()},
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': ObjectId(topic_id),
                        'silenced': False,
                        'hidden': False,
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error silencing post: {str(e)}")
            return False

    def unsilence_post(self, user_id: str, post_id: str, topic_id: str) -> bool:
        """Unsilence a specific post."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$pull': {'silenced_posts': ObjectId(post_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unsilencing post: {str(e)}")
            return False

    def silence_chat(self, user_id: str, chat_id: str, topic_id: str) -> bool:
        """Silence a specific chat."""
        try:
            # Check if topic is silenced
            topic_settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'silenced': True
            })
            
            if topic_settings:
                # Topic is silenced, so chat is automatically silenced
                return True

            # Add chat to silenced list
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$addToSet': {'silenced_chats': ObjectId(chat_id)},
                    '$set': {'updated_at': datetime.utcnow()},
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': ObjectId(topic_id),
                        'silenced': False,
                        'hidden': False,
                        'silenced_posts': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error silencing chat: {str(e)}")
            return False

    def unsilence_chat(self, user_id: str, chat_id: str, topic_id: str) -> bool:
        """Unsilence a specific chat."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$pull': {'silenced_chats': ObjectId(chat_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unsilencing chat: {str(e)}")
            return False

    def hide_topic(self, user_id: str, topic_id: str) -> bool:
        """Hide a topic (user can't see it or be tagged in it)."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$set': {
                        'hidden': True,
                        'updated_at': datetime.utcnow()
                    },
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': ObjectId(topic_id),
                        'silenced': False,
                        'silenced_posts': [],
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error hiding topic: {str(e)}")
            return False

    def unhide_topic(self, user_id: str, topic_id: str) -> bool:
        """Unhide a topic."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$set': {
                        'hidden': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unhiding topic: {str(e)}")
            return False

    def hide_post(self, user_id: str, post_id: str, topic_id: str) -> bool:
        """Hide a specific post."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$addToSet': {'hidden_posts': ObjectId(post_id)},
                    '$set': {'updated_at': datetime.utcnow()},
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': ObjectId(topic_id),
                        'silenced': False,
                        'hidden': False,
                        'silenced_posts': [],
                        'silenced_chats': [],
                        'hidden_chats': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error hiding post: {str(e)}")
            return False

    def unhide_post(self, user_id: str, post_id: str, topic_id: str) -> bool:
        """Unhide a specific post."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$pull': {'hidden_posts': ObjectId(post_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unhiding post: {str(e)}")
            return False

    def hide_chat(self, user_id: str, chat_id: str, topic_id: str) -> bool:
        """Hide a specific chat."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$addToSet': {'hidden_chats': ObjectId(chat_id)},
                    '$set': {'updated_at': datetime.utcnow()},
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': ObjectId(topic_id),
                        'silenced': False,
                        'hidden': False,
                        'silenced_posts': [],
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error hiding chat: {str(e)}")
            return False

    def unhide_chat(self, user_id: str, chat_id: str, topic_id: str) -> bool:
        """Unhide a specific chat."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': ObjectId(topic_id)
                },
                {
                    '$pull': {'hidden_chats': ObjectId(chat_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unhiding chat: {str(e)}")
            return False

    def is_topic_silenced(self, user_id: str, topic_id: str) -> bool:
        """Check if a topic is silenced for a user."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'silenced': True
            })
            return settings is not None
        except Exception:
            return False

    def is_topic_hidden(self, user_id: str, topic_id: str) -> bool:
        """Check if a topic is hidden for a user."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'hidden': True
            })
            return settings is not None
        except Exception:
            return False

    def is_post_silenced(self, user_id: str, post_id: str, topic_id: str) -> bool:
        """Check if a post is silenced for a user (includes topic-level silencing)."""
        try:
            # Check topic-level silencing
            if self.is_topic_silenced(user_id, topic_id):
                return True

            # Check post-level silencing
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'silenced_posts': ObjectId(post_id)
            })
            return settings is not None
        except Exception:
            return False

    def is_post_hidden(self, user_id: str, post_id: str, topic_id: str) -> bool:
        """Check if a post is hidden for a user."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'hidden_posts': ObjectId(post_id)
            })
            return settings is not None
        except Exception:
            return False

    def is_chat_silenced(self, user_id: str, chat_id: str, topic_id: str) -> bool:
        """Check if a chat is silenced for a user (includes topic-level silencing)."""
        try:
            # Check topic-level silencing
            if self.is_topic_silenced(user_id, topic_id):
                return True

            # Check chat-level silencing
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'silenced_chats': ObjectId(chat_id)
            })
            return settings is not None
        except Exception:
            return False

    def is_chat_hidden(self, user_id: str, chat_id: str, topic_id: str) -> bool:
        """Check if a chat is hidden for a user."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id),
                'hidden_chats': ObjectId(chat_id)
            })
            return settings is not None
        except Exception:
            return False

    def get_hidden_items(self, user_id: str) -> Dict[str, Any]:
        """Get all hidden items for a user."""
        try:
            settings = list(self.collection.find({
                'user_id': ObjectId(user_id),
                '$or': [
                    {'hidden': True},
                    {'hidden_posts': {'$exists': True, '$ne': []}},
                    {'hidden_chats': {'$exists': True, '$ne': []}}
                ]
            }))

            hidden_topics = []
            hidden_posts = []
            hidden_chats = []

            for setting in settings:
                topic_id = str(setting.get('topic_id', ''))
                if setting.get('hidden', False):
                    hidden_topics.append(topic_id)
                
                if 'hidden_posts' in setting and setting['hidden_posts']:
                    hidden_posts.extend([str(p) for p in setting['hidden_posts']])
                
                if 'hidden_chats' in setting and setting['hidden_chats']:
                    hidden_chats.extend([str(c) for c in setting['hidden_chats']])

            # Get deleted private messages
            from models.private_message import PrivateMessage
            pm_model = PrivateMessage(self.db)
            deleted_messages = pm_model.get_deleted_messages_for_user(user_id)
            hidden_private_messages = [
                {
                    'id': msg['_id'],
                    'other_user_id': msg.get('other_user_id'),
                    'other_username': msg.get('other_username'),
                    'content': msg.get('content', '')[:50] + '...' if len(msg.get('content', '')) > 50 else msg.get('content', ''),
                    'created_at': msg.get('created_at')
                }
                for msg in deleted_messages
            ]

            return {
                'topics': hidden_topics,
                'posts': hidden_posts,
                'chats': hidden_chats,
                'private_messages': hidden_private_messages
            }
        except Exception as e:
            logger.error(f"Error getting hidden items: {str(e)}")
            return {'topics': [], 'posts': [], 'chats': [], 'private_messages': []}

    def get_silenced_items(self, user_id: str) -> Dict[str, Any]:
        """Get all silenced items for a user."""
        try:
            settings = list(self.collection.find({
                'user_id': ObjectId(user_id),
                '$or': [
                    {'silenced': True},
                    {'silenced_posts': {'$exists': True, '$ne': []}},
                    {'silenced_chats': {'$exists': True, '$ne': []}}
                ]
            }))

            silenced_topics = []
            silenced_posts = []
            silenced_chats = []

            for setting in settings:
                topic_id = str(setting.get('topic_id', ''))
                if setting.get('silenced', False):
                    silenced_topics.append(topic_id)
                
                if 'silenced_posts' in setting and setting['silenced_posts']:
                    silenced_posts.extend([str(p) for p in setting['silenced_posts']])
                
                if 'silenced_chats' in setting and setting['silenced_chats']:
                    silenced_chats.extend([str(c) for c in setting['silenced_chats']])

            return {
                'topics': silenced_topics,
                'posts': silenced_posts,
                'chats': silenced_chats
            }
        except Exception as e:
            logger.error(f"Error getting silenced items: {str(e)}")
            return {'topics': [], 'posts': [], 'chats': []}

