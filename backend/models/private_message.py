from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class PrivateMessage:
    """Private message model for user-to-user messaging."""

    def __init__(self, db):
        self.db = db
        self.collection = db.private_messages

    def send_message(self, from_user_id: str, to_user_id: str, content: str,
                    message_type: str = 'text', gif_url: Optional[str] = None) -> str:
        """Send a private message between users."""
        # Validate and filter content
        filtered_content = self._filter_content(content)

        # Check if users can message each other
        if not self._can_users_message(from_user_id, to_user_id):
            raise ValueError("Cannot send message to this user")

        message_data = {
            'from_user_id': ObjectId(from_user_id),
            'to_user_id': ObjectId(to_user_id),
            'content': filtered_content,
            'message_type': message_type,  # 'text', 'emoji', 'gif'
            'gif_url': gif_url,
            'is_read': False,
            'read_at': None,
            'created_at': datetime.utcnow()
        }

        result = self.collection.insert_one(message_data)
        return str(result.inserted_id)

    def _can_users_message(self, from_user_id: str, to_user_id: str) -> bool:
        """Check if users can message each other."""
        from .user import User
        user_model = User(self.db)

        # Check if either user is banned
        from_user = user_model.get_user_by_id(from_user_id)
        to_user = user_model.get_user_by_id(to_user_id)

        if not from_user or not to_user:
            return False

        if user_model.is_user_banned(from_user_id) or user_model.is_user_banned(to_user_id):
            return False

        # Check if users have blocked each other (implement if needed)
        # For now, allow all users to message each other

        return True

    def get_conversation(self, user_id: str, other_user_id: str, limit: int = 50,
                        before_message_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get conversation between two users."""
        query = {
            '$or': [
                {'from_user_id': ObjectId(user_id), 'to_user_id': ObjectId(other_user_id)},
                {'from_user_id': ObjectId(other_user_id), 'to_user_id': ObjectId(user_id)}
            ]
        }

        # Pagination
        if before_message_id:
            try:
                before_message = self.collection.find_one({'_id': ObjectId(before_message_id)})
                if before_message:
                    query['created_at'] = {'$lt': before_message['created_at']}
            except:
                pass

        messages = list(self.collection.find(query)
                       .sort([('created_at', -1)])
                       .limit(limit))

        # Reverse to get chronological order and add details
        messages.reverse()
        for message in messages:
            message['_id'] = str(message['_id'])
            message['from_user_id'] = str(message['from_user_id'])
            message['to_user_id'] = str(message['to_user_id'])

            # Add sender details
            from .user import User
            user_model = User(self.db)
            sender = user_model.get_user_by_id(message['from_user_id'])
            if sender:
                message['sender_username'] = sender['username']

            # Check if message is from or to current user
            message['is_from_me'] = message['from_user_id'] == user_id
            message['is_to_me'] = message['to_user_id'] == user_id

        return messages

    def get_message_by_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific private message."""
        message = self.collection.find_one({'_id': ObjectId(message_id)})
        if message:
            message['_id'] = str(message['_id'])
            message['from_user_id'] = str(message['from_user_id'])
            message['to_user_id'] = str(message['to_user_id'])
        return message

    def mark_as_read(self, message_id: str, user_id: str) -> bool:
        """Mark a message as read."""
        message = self.collection.find_one({
            '_id': ObjectId(message_id),
            'to_user_id': ObjectId(user_id),
            'is_read': False
        })

        if not message:
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(message_id)},
            {
                '$set': {
                    'is_read': True,
                    'read_at': datetime.utcnow()
                }
            }
        )

        return result.modified_count > 0

    def mark_conversation_as_read(self, user_id: str, other_user_id: str) -> int:
        """Mark all messages from a user as read."""
        result = self.collection.update_many(
            {
                'from_user_id': ObjectId(other_user_id),
                'to_user_id': ObjectId(user_id),
                'is_read': False
            },
            {
                '$set': {
                    'is_read': True,
                    'read_at': datetime.utcnow()
                }
            }
        )

        return result.modified_count

    def get_unread_count(self, user_id: str) -> int:
        """Get unread message count for a user."""
        return self.collection.count_documents({
            'to_user_id': ObjectId(user_id),
            'is_read': False
        })

    def get_conversations(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get list of conversations with recent messages."""
        # Find unique conversation partners
        pipeline = [
            {
                '$match': {
                    '$or': [
                        {'from_user_id': ObjectId(user_id)},
                        {'to_user_id': ObjectId(user_id)}
                    ]
                }
            },
            {
                '$addFields': {
                    'other_user_id': {
                        '$cond': {
                            'if': {'$eq': ['$from_user_id', ObjectId(user_id)]},
                            'then': '$to_user_id',
                            'else': '$from_user_id'
                        }
                    }
                }
            },
            {
                '$sort': {'created_at': -1}
            },
            {
                '$group': {
                    '_id': '$other_user_id',
                    'last_message': {'$first': '$$ROOT'},
                    'unread_count': {
                        '$sum': {
                            '$cond': [
                                {
                                    '$and': [
                                        {'$eq': ['$to_user_id', ObjectId(user_id)]},
                                        {'$eq': ['$is_read', False]}
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                '$limit': limit
            }
        ]

        conversations = list(self.collection.aggregate(pipeline))

        # Add user details
        from .user import User
        user_model = User(self.db)

        for conv in conversations:
            conv['other_user_id'] = str(conv['_id'])
            conv['last_message']['_id'] = str(conv['last_message']['_id'])
            conv['last_message']['from_user_id'] = str(conv['last_message']['from_user_id'])
            conv['last_message']['to_user_id'] = str(conv['last_message']['to_user_id'])

            # Get other user details
            other_user = user_model.get_user_by_id(conv['other_user_id'])
            if other_user:
                conv['other_user'] = {
                    'id': str(other_user['_id']),
                    'username': other_user['username']
                }

            # Determine if last message is from current user
            conv['last_message']['is_from_me'] = conv['last_message']['from_user_id'] == user_id

        return conversations

    def delete_message(self, message_id: str, user_id: str) -> bool:
        """Delete a private message (only sender or receiver can delete)."""
        message = self.collection.find_one({
            '_id': ObjectId(message_id),
            '$or': [
                {'from_user_id': ObjectId(user_id)},
                {'to_user_id': ObjectId(user_id)}
            ]
        })

        if not message:
            return False

        result = self.collection.delete_one({'_id': ObjectId(message_id)})
        return result.deleted_count > 0

    def delete_conversation(self, user_id: str, other_user_id: str) -> int:
        """Delete entire conversation between two users."""
        result = self.collection.delete_many({
            '$or': [
                {'from_user_id': ObjectId(user_id), 'to_user_id': ObjectId(other_user_id)},
                {'from_user_id': ObjectId(other_user_id), 'to_user_id': ObjectId(user_id)}
            ]
        })

        return result.deleted_count

    def search_messages(self, user_id: str, query: str, other_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search private messages."""
        search_query = {
            '$or': [
                {'from_user_id': ObjectId(user_id)},
                {'to_user_id': ObjectId(user_id)}
            ],
            'content': {'$regex': query, '$options': 'i'}
        }

        if other_user_id:
            search_query['$and'] = [
                search_query,
                {
                    '$or': [
                        {'from_user_id': ObjectId(other_user_id)},
                        {'to_user_id': ObjectId(other_user_id)}
                    ]
                }
            ]

        messages = list(self.collection.find(search_query)
                       .sort([('created_at', -1)])
                       .limit(50))

        for message in messages:
            message['_id'] = str(message['_id'])
            message['from_user_id'] = str(message['from_user_id'])
            message['to_user_id'] = str(message['to_user_id'])
            message['is_from_me'] = message['from_user_id'] == user_id

            from .user import User
            user_model = User(self.db)
            sender = user_model.get_user_by_id(message['from_user_id'])
            if sender:
                message['sender_username'] = sender['username']

        return messages

    def _filter_content(self, content: str) -> str:
        """Filter private message content for links and inappropriate content."""
        import re

        # Remove URLs/links
        url_pattern = r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?'
        content = re.sub(url_pattern, '[Link removed]', content, flags=re.IGNORECASE)

        # Basic profanity filtering
        profanity_list = ['fuck', 'shit', 'cunt', 'bitch', 'asshole']
        words = content.split()
        for i, word in enumerate(words):
            if word.lower().strip('.,!?;:') in profanity_list:
                words[i] = '*' * len(word)
        content = ' '.join(words)

        return content.strip()

    def get_message_stats(self, user_id: str) -> Dict[str, Any]:
        """Get messaging statistics for a user."""
        pipeline = [
            {
                '$match': {
                    '$or': [
                        {'from_user_id': ObjectId(user_id)},
                        {'to_user_id': ObjectId(user_id)}
                    ]
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total_messages': {'$sum': 1},
                    'sent_messages': {
                        '$sum': {
                            '$cond': [
                                {'$eq': ['$from_user_id', ObjectId(user_id)]},
                                1,
                                0
                            ]
                        }
                    },
                    'received_messages': {
                        '$sum': {
                            '$cond': [
                                {'$eq': ['$to_user_id', ObjectId(user_id)]},
                                1,
                                0
                            ]
                        }
                    },
                    'unread_messages': {
                        '$sum': {
                            '$cond': [
                                {
                                    '$and': [
                                        {'$eq': ['$to_user_id', ObjectId(user_id)]},
                                        {'$eq': ['$is_read', False]}
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]

        stats = list(self.collection.aggregate(pipeline))
        return stats[0] if stats else {
            'total_messages': 0,
            'sent_messages': 0,
            'received_messages': 0,
            'unread_messages': 0
        }