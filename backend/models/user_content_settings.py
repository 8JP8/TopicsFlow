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
                        'hidden_comments': [],
                        'hidden_chat_messages': [],
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
                        'hidden_comments': [],
                        'hidden_chat_messages': [],
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
                        'hidden_comments': [],
                        'hidden_chat_messages': [],
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
                        'hidden_comments': [],
                        'hidden_chat_messages': [],
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
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'hidden_comments': [],
                        'hidden_chat_messages': [],
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
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'hidden_comments': [],
                        'hidden_chat_messages': [],
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

    def hide_comment(self, user_id: str, comment_id: str) -> bool:
        """Hide a specific comment."""
        try:
            # Comments don't have a direct topic_id association in settings, 
            # so we store them in a general 'hidden_comments' list for the user (global or mapped to dummy topic)
            # However, existing structure uses topic_id as partial key. 
            # We will use a special 'global' topic_id or just insert a document without topic_id for global settings?
            # The current schema key is (user_id, topic_id). 
            # BUT: We can have a "global" settings document where topic_id is null?
            # Looking at code: update_one query uses topic_id.
            # If we want global hidden items, we might need a different collection or a workaround.
            # Workaround: Use a specific "Global" topic_id or just append to ALL? No, that's bad.
            # Strategy: Store global hidden items (comments/messages) in a document where topic_id is None.
            
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': None 
                },
                {
                    '$addToSet': {'hidden_comments': ObjectId(comment_id)},
                    '$set': {'updated_at': datetime.utcnow()},
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': None,
                        'silenced': False,
                        'hidden': False,
                        'silenced_posts': [],
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'hidden_chat_messages': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error hiding comment: {str(e)}")
            return False

    def unhide_comment(self, user_id: str, comment_id: str) -> bool:
        """Unhide a specific comment."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': None
                },
                {
                    '$pull': {'hidden_comments': ObjectId(comment_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unhiding comment: {str(e)}")
            return False

    def is_comment_hidden(self, user_id: str, comment_id: str) -> bool:
        """Check if a comment is hidden."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': None,
                'hidden_comments': ObjectId(comment_id)
            })
            return settings is not None
        except Exception:
            return False

    def hide_chat_message(self, user_id: str, message_id: str) -> bool:
        """Hide a specific chat/topic message."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': None
                },
                {
                    '$addToSet': {'hidden_chat_messages': ObjectId(message_id)},
                    '$set': {'updated_at': datetime.utcnow()},
                    '$setOnInsert': {
                        'user_id': ObjectId(user_id),
                        'topic_id': None,
                        'silenced': False,
                        'hidden': False,
                        'silenced_posts': [],
                        'silenced_chats': [],
                        'hidden_posts': [],
                        'hidden_chats': [],
                        'hidden_comments': [],
                        'created_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error hiding chat message: {str(e)}")
            return False

    def unhide_chat_message(self, user_id: str, message_id: str) -> bool:
        """Unhide a specific chat/topic message."""
        try:
            self.collection.update_one(
                {
                    'user_id': ObjectId(user_id),
                    'topic_id': None
                },
                {
                    '$pull': {'hidden_chat_messages': ObjectId(message_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return True
        except Exception as e:
            logger.error(f"Error unhiding chat message: {str(e)}")
            return False

    def is_chat_message_hidden(self, user_id: str, message_id: str) -> bool:
        """Check if a chat message is hidden."""
        try:
            settings = self.collection.find_one({
                'user_id': ObjectId(user_id),
                'topic_id': None,
                'hidden_chat_messages': ObjectId(message_id)
            })
            return settings is not None
        except Exception:
            return False

    def get_hidden_items(self, user_id: str) -> Dict[str, Any]:
        """Get all hidden items for a user."""
        try:
            settings = list(self.collection.find({
                'user_id': ObjectId(user_id)
            }))

            hidden_topics_ids = []
            hidden_posts_ids = []
            hidden_chats_ids = []
            hidden_comments_ids = []
            hidden_chat_messages_ids = []

            for setting in settings:
                topic_id = str(setting.get('topic_id', ''))
                if setting.get('hidden', False) and topic_id and topic_id != 'None':
                    hidden_topics_ids.append(topic_id)
                
                if 'hidden_posts' in setting and setting['hidden_posts']:
                    hidden_posts_ids.extend([str(p) for p in setting['hidden_posts']])
                
                if 'hidden_chats' in setting and setting['hidden_chats']:
                    hidden_chats_ids.extend([str(c) for c in setting['hidden_chats']])

                if 'hidden_comments' in setting and setting['hidden_comments']:
                    hidden_comments_ids.extend([str(c) for c in setting['hidden_comments']])
                
                if 'hidden_chat_messages' in setting and setting['hidden_chat_messages']:
                    hidden_chat_messages_ids.extend([str(m) for m in setting['hidden_chat_messages']])

            # Fetch details for topics
            hidden_topics = []
            if hidden_topics_ids:
                from models.topic import Topic
                topic_model = Topic(self.db)
                for t_id in hidden_topics_ids:
                    topic = topic_model.get_topic_by_id(t_id)
                    if topic:
                        hidden_topics.append({
                            'id': t_id,
                            'title': topic.get('title', 'Unknown Topic'),
                            'description': topic.get('description', ''),
                            'created_at': topic.get('created_at')
                        })

            # Fetch details for posts
            hidden_posts = []
            if hidden_posts_ids:
                from models.post import Post
                post_model = Post(self.db)
                for p_id in hidden_posts_ids:
                    post = post_model.get_post_by_id(p_id)
                    if post:
                        hidden_posts.append({
                            'id': p_id,
                            'title': post.get('title', 'Untitled Post'),
                            'author_username': post.get('author_username', 'Unknown'),
                            'created_at': post.get('created_at'),
                            'topic_id': post.get('topic_id')
                        })

            # Fetch details for chats (Topic Conversations and Group Chats)
            hidden_chats = []
            if hidden_chats_ids:
                from models.chat_room import ChatRoom
                chat_model = ChatRoom(self.db)
                for c_id in hidden_chats_ids:
                    chat = chat_model.get_chat_room_by_id(c_id)
                    if chat:
                        hidden_chats.append({
                            'id': c_id,
                            'name': chat.get('name', 'Unnamed Chat'),
                            'description': chat.get('description', ''),
                            'topic_id': chat.get('topic_id'),
                            'is_group_chat': not chat.get('topic_id') or chat.get('topic_id') == 'None',
                            'created_at': chat.get('created_at')
                        })

            # Fetch details for comments
            hidden_comments = []
            if hidden_comments_ids:
                from models.comment import Comment
                comment_model = Comment(self.db)
                for c_id in hidden_comments_ids:
                    comment = comment_model.get_comment_by_id(c_id)
                    if comment:
                        hidden_comments.append({
                            'id': c_id,
                            'content': comment.get('content', '')[:50] + '...' if len(comment.get('content', '')) > 50 else comment.get('content', ''),
                            'author_username': comment.get('author_username', 'Unknown'),
                            'created_at': comment.get('created_at'),
                            'post_id': comment.get('post_id')
                        })

            # Fetch details for chat messages
            hidden_messages = []
            if hidden_chat_messages_ids:
                from models.message import Message
                message_model = Message(self.db)
                for m_id in hidden_chat_messages_ids:
                    message = message_model.get_message_by_id(m_id)
                    if message:
                        msg_type = 'topic'
                        if message.get('chat_room_id'):
                            msg_type = 'group'
                        
                        hidden_messages.append({
                            'id': m_id,
                            'content': message.get('content', '')[:50] + '...' if len(message.get('content', '')) > 50 else message.get('content', ''),
                            'sender_username': message.get('sender_username', 'Unknown'),
                            'created_at': message.get('created_at'),
                            'type': msg_type,
                            'topic_id': message.get('topic_id'),
                            'chat_room_id': message.get('chat_room_id')
                        })

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
                'hidden_topics': hidden_topics,
                'hidden_posts': hidden_posts,
                'hidden_chats': hidden_chats,
                'hidden_comments': hidden_comments,
                'hidden_chat_messages': hidden_messages,
                'hidden_private_messages': hidden_private_messages
            }
        except Exception as e:
            logger.error(f"Error getting hidden items: {str(e)}")
            return {'topics': [], 'posts': [], 'chats': [], 'comments': [], 'messages': [], 'private_messages': []}

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

    def get_hidden_chat_ids(self, user_id: str, topic_id: Optional[str]) -> List[str]:
        """Get IDs of hidden chats for a specific topic (or None for group chats)."""
        try:
            query = {
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id) if topic_id else None
            }

            settings = self.collection.find_one(query, {'hidden_chats': 1})

            if settings and 'hidden_chats' in settings:
                return [str(chat_id) for chat_id in settings['hidden_chats']]
            return []
        except Exception as e:
            logger.error(f"Error getting hidden chat IDs: {str(e)}")
            return []
