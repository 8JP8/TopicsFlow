from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
import re


class Message:
    """Message model for chat message management."""

    def __init__(self, db):
        self.db = db
        self.collection = db.messages

    def create_message(self, topic_id: Optional[str] = None, user_id: str = None, content: str = None,
                      message_type: str = 'text',
                      anonymous_identity: Optional[str] = None,
                      gif_url: Optional[str] = None,
                      chat_room_id: Optional[str] = None,
                      post_id: Optional[str] = None,
                      comment_id: Optional[str] = None,
                      attachments: Optional[List[Dict[str, Any]]] = None) -> str:
        """Create a new message in a topic, chat room, post, or comment."""
        # Validate and filter content
        filtered_content = self._filter_content(content) if content else ''
        
        # Process mentions
        mentions = self._extract_mentions(filtered_content)

        # Clean attachments - remove any base64 data before storing
        clean_attachments = []
        if attachments:
            for att in attachments:
                clean_att = {k: v for k, v in att.items() if k != 'data'}
                clean_attachments.append(clean_att)
        
        message_data = {
            'user_id': ObjectId(user_id),
            'content': filtered_content,
            'message_type': message_type,  # 'text', 'emoji', 'gif', 'image', 'video', 'file', 'system'
            'anonymous_identity': anonymous_identity,
            'gif_url': gif_url,
            'attachments': clean_attachments,  # List of attachment objects: {type, file_id, url, filename, size, mime_type} - NO base64 data
            'is_deleted': False,
            'deleted_by': None,
            'deleted_at': None,
            'deletion_reason': None,  # Reason for deletion (for owner deletions)
            'reports': [],
            'mentions': mentions,  # Array of user_ids mentioned
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Support both old (topic_id) and new (chat_room_id) formats
        if topic_id and str(topic_id) not in ['None', 'null', 'undefined']:
            try:
                message_data['topic_id'] = ObjectId(topic_id)
            except:
                # If invalid ObjectId, just ignore it (treat as None)
                pass
        if chat_room_id:
            message_data['chat_room_id'] = ObjectId(chat_room_id)
        if post_id:
            message_data['post_id'] = ObjectId(post_id)
        if comment_id:
            message_data['comment_id'] = ObjectId(comment_id)

        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[DB] Inserting message into database: user_id={user_id}, topic_id={topic_id}, chat_room_id={chat_room_id}")
        
        result = self.collection.insert_one(message_data)
        
        inserted_id = str(result.inserted_id)
        logger.info(f"[DB] Message inserted successfully: _id={inserted_id}")
        
        # Verify insertion
        verify_message = self.collection.find_one({'_id': result.inserted_id})
        if verify_message:
            logger.info(f"[DB] Message verification successful: found message with content length {len(verify_message.get('content', ''))}")
        else:
            logger.error(f"[DB] Message verification FAILED: message not found after insertion!")

        # Update last activity based on message type
        if topic_id:
            # Legacy topic support
            try:
                from .topic import Topic
                topic_model = Topic(self.db)
                topic_model.update_last_activity(topic_id)
            except:
                pass
        elif chat_room_id:
            # New chat room support
            try:
                from .chat_room import ChatRoom
                chat_room_model = ChatRoom(self.db)
                chat_room_model.update_last_activity(chat_room_id)
                chat_room_model.increment_message_count(chat_room_id)
            except:
                pass

        # Send notifications for mentions
        if mentions:
            self._notify_mentions(inserted_id, mentions, user_id)

        return inserted_id

    def get_messages(self, topic_id: str, limit: int = 50, before_message_id: Optional[str] = None,
                    user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get messages for a topic with pagination."""
        query = {
            'topic_id': ObjectId(topic_id),
            'is_deleted': False
        }

        # Pagination: get messages before a specific message
        if before_message_id:
            try:
                before_message = self.collection.find_one({'_id': ObjectId(before_message_id)})
                if before_message:
                    query['created_at'] = {'$lt': before_message['created_at']}
            except:
                pass

        # If user is banned from topic, return empty list
        from .topic import Topic
        topic_model = Topic(self.db)
        if user_id and topic_model.is_user_banned_from_topic(topic_id, user_id):
            return []

        messages = list(self.collection.find(query)
                       .sort([('created_at', -1)])
                       .limit(limit))

        # Reverse to get chronological order and convert ObjectIds
        messages.reverse()
        for message in messages:
            message['_id'] = str(message['_id'])
            message['id'] = str(message['_id'])  # Also add 'id' field for frontend compatibility
            message['topic_id'] = str(message['topic_id'])
            message['user_id'] = str(message['user_id'])
            
            # Convert datetime to ISO string for JSON serialization
            if 'created_at' in message and isinstance(message['created_at'], datetime):
                message['created_at'] = message['created_at'].isoformat()
            if 'updated_at' in message and isinstance(message['updated_at'], datetime):
                message['updated_at'] = message['updated_at'].isoformat()

            # Get user details (or anonymous identity)
            if message.get('anonymous_identity'):
                message['display_name'] = message['anonymous_identity']
                message['is_anonymous'] = True
                message['sender_username'] = message['anonymous_identity']  # For consistency
                message['profile_picture'] = None  # Explicitly set to None for anonymous
                message['is_admin'] = False
                message['is_owner'] = False
                message['is_moderator'] = False
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(message['user_id'])
                if user:
                    message['display_name'] = user['username']
                    message['sender_username'] = user['username']  # Ensure sender_username is set
                    message['profile_picture'] = user.get('profile_picture')
                    message['is_admin'] = user.get('is_admin', False)
                    
                    # Check if owner or moderator
                    message['is_owner'] = False
                    message['is_moderator'] = False
                    if message.get('chat_room_id'):
                        from .chat_room import ChatRoom
                        chat_room_model = ChatRoom(self.db)
                        room = chat_room_model.get_chat_room_by_id(str(message['chat_room_id']))
                        if room:
                            message['is_owner'] = str(room.get('owner_id')) == str(message['user_id'])
                            moderators = room.get('moderators', [])
                            message['is_moderator'] = any(str(mod) == str(message['user_id']) for mod in moderators)
                    elif message.get('topic_id'):
                        from .topic import Topic
                        topic_model = Topic(self.db)
                        topic = topic_model.get_topic_by_id(str(message['topic_id']))
                        if topic:
                            message['is_owner'] = str(topic.get('owner_id')) == str(message['user_id'])
                            message['is_moderator'] = topic_model.is_user_moderator(str(message['topic_id']), str(message['user_id']))
                else:
                    message['display_name'] = 'Deleted User'
                    message['sender_username'] = 'Deleted User'
                    message['profile_picture'] = None
                    message['is_admin'] = False
                    message['is_owner'] = False
                    message['is_moderator'] = False
                message['is_anonymous'] = False

            # Get user's permission level for this message
            if user_id:
                message['can_delete'] = self._can_delete_message(topic_id, message['_id'], user_id)
                message['can_report'] = True
            else:
                message['can_delete'] = False
                message['can_report'] = False

        return messages

    def get_message_by_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific message by ID."""
        message = self.collection.find_one({'_id': ObjectId(message_id)})
        if message:
            message['_id'] = str(message['_id'])
            message['id'] = str(message['_id'])  # Also add 'id' field for frontend compatibility
            
            # Convert topic_id if present
            if 'topic_id' in message and message['topic_id'] is not None:
                if isinstance(message['topic_id'], ObjectId):
                    message['topic_id'] = str(message['topic_id'])
            
            # Convert chat_room_id if present
            if 'chat_room_id' in message and message['chat_room_id'] is not None:
                if isinstance(message['chat_room_id'], ObjectId):
                    message['chat_room_id'] = str(message['chat_room_id'])
            
            message['user_id'] = str(message['user_id'])
            
            # Convert datetime to ISO string for JSON serialization
            if 'created_at' in message and isinstance(message['created_at'], datetime):
                message['created_at'] = message['created_at'].isoformat()
            if 'updated_at' in message and isinstance(message['updated_at'], datetime):
                message['updated_at'] = message['updated_at'].isoformat()
            
            # Convert mentions to strings if present
            if 'mentions' in message and isinstance(message['mentions'], list):
                message['mentions'] = [str(m) if isinstance(m, ObjectId) else m for m in message['mentions']]
            
            # Convert reports array if present
            if 'reports' in message and isinstance(message['reports'], list):
                for report in message['reports']:
                    if isinstance(report, dict):
                        if 'reported_by' in report and isinstance(report['reported_by'], ObjectId):
                            report['reported_by'] = str(report['reported_by'])
                        if 'created_at' in report and isinstance(report['created_at'], datetime):
                            report['created_at'] = report['created_at'].isoformat()
            
            # Get user details (or anonymous identity) - same as get_messages
            if message.get('anonymous_identity'):
                message['display_name'] = message['anonymous_identity']
                message['is_anonymous'] = True
                message['sender_username'] = message['anonymous_identity']  # For consistency
                message['profile_picture'] = None  # Explicitly set to None for anonymous
                message['is_admin'] = False
                message['is_owner'] = False
                message['is_moderator'] = False
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(message['user_id'])
                if user:
                    message['display_name'] = user['username']
                    message['sender_username'] = user['username']  # Ensure sender_username is set
                    message['profile_picture'] = user.get('profile_picture')
                    message['is_admin'] = user.get('is_admin', False)
                    
                    # Check if owner or moderator
                    message['is_owner'] = False
                    message['is_moderator'] = False
                    if message.get('chat_room_id'):
                        from .chat_room import ChatRoom
                        chat_room_model = ChatRoom(self.db)
                        room = chat_room_model.get_chat_room_by_id(str(message['chat_room_id']))
                        if room:
                            message['is_owner'] = str(room.get('owner_id')) == str(message['user_id'])
                            moderators = room.get('moderators', [])
                            message['is_moderator'] = any(str(mod) == str(message['user_id']) for mod in moderators)
                    elif message.get('topic_id'):
                        from .topic import Topic
                        topic_model = Topic(self.db)
                        topic = topic_model.get_topic_by_id(str(message['topic_id']))
                        if topic:
                            message['is_owner'] = str(topic.get('owner_id')) == str(message['user_id'])
                            message['is_moderator'] = topic_model.is_user_moderator(str(message['topic_id']), str(message['user_id']))
                else:
                    message['display_name'] = 'Deleted User'
                    message['sender_username'] = 'Deleted User'
                    message['profile_picture'] = None
                    message['is_admin'] = False
                    message['is_owner'] = False
                    message['is_moderator'] = False
                message['is_anonymous'] = False
        return message

    def delete_message(self, message_id: str, deleted_by: str, deletion_reason: Optional[str] = None, mode: str = 'soft') -> bool:
        """Delete a message (soft or hard delete). Supports deletion with reason for chat owners."""
        # Check if user has permission to delete this message
        message = self.get_message_by_id(message_id)
        if not message:
            return False

        if not self._can_delete_message(message, deleted_by):
            return False

        if mode == 'hard':
            # Hard delete - remove from collection
            result = self.collection.delete_one({'_id': ObjectId(message_id)})
            
            # Decrement message count if it was in a chat room
            if result.deleted_count > 0 and message.get('chat_room_id'):
                try:
                    from .chat_room import ChatRoom
                    chat_room_model = ChatRoom(self.db)
                    chat_room_model.decrement_message_count(str(message['chat_room_id']))
                except:
                    pass
            
            return result.deleted_count > 0
        else:
            # Soft delete - set is_deleted flag and pending status
            from datetime import timedelta
            
            update_data = {
                'is_deleted': True,
                'deleted_by': ObjectId(deleted_by),
                'deleted_at': datetime.utcnow(),
                'permanent_delete_at': datetime.utcnow() + timedelta(days=30)  # Permanent delete after 30 days
            }
            
            # Add deletion reason if provided (for owner deletions)
            if deletion_reason:
                update_data['deletion_reason'] = deletion_reason

            result = self.collection.update_one(
                {'_id': ObjectId(message_id)},
                {'$set': update_data}
            )

            return result.modified_count > 0

    def _can_delete_message(self, message: Dict[str, Any], user_id: str) -> bool:
        """Check if user can delete a message. Supports both topic messages and chat room messages."""
        # Users can always delete their own messages
        if message.get('user_id') == user_id or str(message.get('user_id')) == user_id:
            return True

        # Check permissions based on message type
        if message.get('chat_room_id'):
            # Chat room message - check chat room permissions
            from .chat_room import ChatRoom
            chat_room_model = ChatRoom(self.db)
            permission_level = chat_room_model.get_user_permission_level(
                str(message['chat_room_id']), 
                user_id
            )
            # Owner (3) or moderator (2) can delete any message
            return permission_level >= 2
        elif message.get('topic_id'):
            # Topic message - check topic permissions
            from .topic import Topic
            topic_model = Topic(self.db)
            permission_level = topic_model.get_user_permission_level(
                str(message['topic_id']), 
                user_id
            )
            # Owner (3) or moderator (2) can delete any message
            return permission_level >= 2

        return False

    def report_message(self, message_id: str, reporter_id: str, reason: str) -> bool:
        """Report a message for moderation."""
        # Check if message exists
        message = self.get_message_by_id(message_id)
        if not message:
            return False

        # Check if user already reported this message
        existing_report = self.collection.find_one({
            '_id': ObjectId(message_id),
            'reports.reported_by': ObjectId(reporter_id)
        })

        if existing_report:
            return False  # Already reported

        report_data = {
            'reported_by': ObjectId(reporter_id),
            'reason': reason,
            'created_at': datetime.utcnow()
        }

        result = self.collection.update_one(
            {'_id': ObjectId(message_id)},
            {'$push': {'reports': report_data}}
        )

        if result.modified_count > 0:
            # Create report entry in reports collection
            from .report import Report
            report_model = Report(self.db)
            report_model.create_report(message_id, reporter_id, reason, message['topic_id'])

        return result.modified_count > 0

    def _filter_content(self, content: str) -> str:
        """Filter message content for links and inappropriate content."""
        # Remove URLs/links
        url_pattern = r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?'
        content = re.sub(url_pattern, '[Link removed]', content, flags=re.IGNORECASE)

        # Basic profanity filtering (can be enhanced with external service)
        profanity_list = ['fuck', 'shit', 'cunt', 'bitch', 'asshole']  # Add more as needed
        words = content.split()
        for i, word in enumerate(words):
            if word.lower().strip('.,!?;:') in profanity_list:
                words[i] = '*' * len(word)
        content = ' '.join(words)

        return content.strip()

    def _extract_mentions(self, content: str) -> List[ObjectId]:
        """Extract @username mentions from content and return list of user IDs."""
        from utils.mention_parser import extract_mentions_as_user_ids
        return extract_mentions_as_user_ids(self.db, content)

    def _notify_mentions(self, message_id: str, mentioned_user_ids: List[ObjectId], sender_id: str) -> None:
        """Send notifications to mentioned users."""
        from utils.mention_parser import notify_mentioned_users
        
        # Determine content type and context
        context = {}
        content_type = 'message'
        
        # Try to get context from message
        try:
            message = self.collection.find_one({'_id': ObjectId(message_id)})
            if message:
                if 'chat_room_id' in message:
                    content_type = 'chat_room_message'
                    context['chat_room_id'] = str(message['chat_room_id'])
                elif 'topic_id' in message:
                    content_type = 'message'
                    context['topic_id'] = str(message['topic_id'])
        except:
            pass
        
        notify_mentioned_users(
            db=self.db,
            content_id=message_id,
            content_type=content_type,
            mentioned_user_ids=mentioned_user_ids,
            sender_id=sender_id,
            context=context
        )

    def get_message_reports(self, message_id: str) -> List[Dict[str, Any]]:
        """Get all reports for a specific message."""
        message = self.collection.find_one({'_id': ObjectId(message_id)})
        if not message:
            return []

        reports = []
        for report in message.get('reports', []):
            from .user import User
            user_model = User(self.db)
            reporter = user_model.get_user_by_id(str(report['reported_by']))
            if reporter:
                reports.append({
                    'id': str(report['_id']) if '_id' in report else None,
                    'reporter_username': reporter['username'],
                    'reason': report['reason'],
                    'created_at': report['created_at']
                })

        return reports

    def search_messages(self, topic_id: str, query: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search messages within a topic."""
        if user_id:
            from .topic import Topic
            topic_model = Topic(self.db)
            if topic_model.is_user_banned_from_topic(topic_id, user_id):
                return []

        search_query = {
            'topic_id': ObjectId(topic_id),
            'is_deleted': False,
            'content': {'$regex': query, '$options': 'i'}
        }

        messages = list(self.collection.find(search_query)
                       .sort([('created_at', -1)])
                       .limit(100))

        for message in messages:
            message['_id'] = str(message['_id'])
            message['topic_id'] = str(message['topic_id'])
            message['user_id'] = str(message['user_id'])

            if message.get('anonymous_identity'):
                message['display_name'] = message['anonymous_identity']
                message['is_anonymous'] = True
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(message['user_id'])
                if user:
                    message['display_name'] = user['username']
                else:
                    message['display_name'] = 'Deleted User'
                message['is_anonymous'] = False

        return messages

    def get_user_message_count(self, topic_id: str, user_id: str) -> int:
        """Get total message count for a user in a topic."""
        return self.collection.count_documents({
            'topic_id': ObjectId(topic_id),
            'user_id': ObjectId(user_id),
            'is_deleted': False
        })

    def get_topic_message_count(self, topic_id: str) -> int:
        """Get total message count for a topic."""
        return self.collection.count_documents({
            'topic_id': ObjectId(topic_id),
            'is_deleted': False
        })

    def get_recent_messages_from_user(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent messages from a user across all topics."""
        messages = list(self.collection.find({
            'user_id': ObjectId(user_id),
            'is_deleted': False
        })
        .sort([('created_at', -1)])
        .limit(limit))

        for message in messages:
            message['_id'] = str(message['_id'])
            message['topic_id'] = str(message['topic_id'])
        
        return messages
    
    def get_deleted_messages(self, limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
        """Get all deleted messages for admin review."""
        query = {'is_deleted': True}
        
        messages = list(self.collection.find(query)
                       .sort([('deleted_at', -1)])
                       .skip(skip)
                       .limit(limit))
        
        for message in messages:
            message['_id'] = str(message['_id'])
            message['user_id'] = str(message.get('user_id', ''))
            message['topic_id'] = str(message.get('topic_id', '')) if message.get('topic_id') else None
            message['chat_room_id'] = str(message.get('chat_room_id', '')) if message.get('chat_room_id') else None
            message['deleted_by'] = str(message.get('deleted_by', '')) if message.get('deleted_by') else None
            
            # Convert datetime to ISO string
            if 'created_at' in message and isinstance(message['created_at'], datetime):
                message['created_at'] = message['created_at'].isoformat()
            if 'deleted_at' in message and isinstance(message['deleted_at'], datetime):
                message['deleted_at'] = message['deleted_at'].isoformat()
            if 'permanent_delete_at' in message and isinstance(message['permanent_delete_at'], datetime):
                message['permanent_delete_at'] = message['permanent_delete_at'].isoformat()
            
            # Get user info
            from .user import User
            user_model = User(self.db)
            user = user_model.get_user_by_id(message['user_id'])
            if user:
                message['username'] = user.get('username', 'Unknown')
            
            deleted_by_user = user_model.get_user_by_id(message['deleted_by']) if message['deleted_by'] else None
            if deleted_by_user:
                message['deleted_by_username'] = deleted_by_user.get('username', 'Unknown')
        
        return messages
    
    def get_deleted_messages_count(self) -> int:
        """Get count of deleted messages."""
        return self.collection.count_documents({'is_deleted': True})
    
    def permanently_delete_message(self, message_id: str) -> bool:
        """Permanently delete a message from the database."""
        result = self.collection.delete_one({'_id': ObjectId(message_id), 'is_deleted': True})
        return result.deleted_count > 0
    
    def permanently_delete_expired_messages(self) -> int:
        """Permanently delete messages that have passed their permanent_delete_at date."""
        now = datetime.utcnow()
        result = self.collection.delete_many({
            'is_deleted': True,
            'permanent_delete_at': {'$lt': now}
        })
        return result.deleted_count