from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
import re


class Message:
    """Message model for chat message management."""

    def __init__(self, db):
        self.db = db
        self.collection = db.messages

    def create_message(self, topic_id: str, user_id: str, content: str,
                      message_type: str = 'text',
                      anonymous_identity: Optional[str] = None,
                      gif_url: Optional[str] = None) -> str:
        """Create a new message in a topic."""
        # Validate and filter content
        filtered_content = self._filter_content(content)

        message_data = {
            'topic_id': ObjectId(topic_id),
            'user_id': ObjectId(user_id),
            'content': filtered_content,
            'message_type': message_type,  # 'text', 'emoji', 'gif', 'system'
            'anonymous_identity': anonymous_identity,
            'gif_url': gif_url,
            'is_deleted': False,
            'deleted_by': None,
            'deleted_at': None,
            'reports': [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        result = self.collection.insert_one(message_data)

        # Update topic last activity
        from .topic import Topic
        topic_model = Topic(self.db)
        topic_model.update_last_activity(topic_id)

        return str(result.inserted_id)

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
            message['topic_id'] = str(message['topic_id'])
            message['user_id'] = str(message['user_id'])

            # Get user details (or anonymous identity)
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
            message['topic_id'] = str(message['topic_id'])
            message['user_id'] = str(message['user_id'])
        return message

    def delete_message(self, message_id: str, deleted_by: str) -> bool:
        """Delete a message (soft delete)."""
        # Check if user has permission to delete this message
        message = self.get_message_by_id(message_id)
        if not message:
            return False

        if not self._can_delete_message(message['topic_id'], message_id, deleted_by):
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(message_id)},
            {
                '$set': {
                    'is_deleted': True,
                    'deleted_by': ObjectId(deleted_by),
                    'deleted_at': datetime.utcnow()
                }
            }
        )

        return result.modified_count > 0

    def _can_delete_message(self, topic_id: str, message_id: str, user_id: str) -> bool:
        """Check if user can delete a message."""
        from .topic import Topic
        topic_model = Topic(self.db)
        permission_level = topic_model.get_user_permission_level(topic_id, user_id)

        # Owner and moderators can delete any message
        if permission_level >= 2:
            return True

        # Users can delete their own messages
        message = self.get_message_by_id(message_id)
        if message and message['user_id'] == user_id:
            return True

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
            message['user_id'] = str(message['user_id'])

        return messages