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

        # Check if either user has blocked the other
        if user_model.is_user_blocked(from_user_id, to_user_id) or user_model.is_user_blocked(to_user_id, from_user_id):
            return False

        return True

    def get_conversation(self, user_id: str, other_user_id: str, limit: int = 50,
                        before_message_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get conversation between two users. Handles self-messages (user_id == other_user_id)."""
        # Handle self-messages: if user_id == other_user_id, get all messages where from and to are the same
        if str(user_id) == str(other_user_id):
            query = {
                'from_user_id': ObjectId(user_id),
                'to_user_id': ObjectId(user_id)
            }
        else:
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
            
            # Convert datetime to ISO string for JSON serialization
            if 'created_at' in message and isinstance(message['created_at'], datetime):
                message['created_at'] = message['created_at'].isoformat()
            if 'read_at' in message and isinstance(message['read_at'], datetime):
                message['read_at'] = message['read_at'].isoformat()

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
            # Convert datetime to ISO string for JSON serialization
            if 'created_at' in message and isinstance(message['created_at'], datetime):
                message['created_at'] = message['created_at'].isoformat()
            if 'read_at' in message and isinstance(message['read_at'], datetime):
                message['read_at'] = message['read_at'].isoformat()
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
                '$sort': {'last_message.created_at': -1}  # Sort by last message date
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
            # Helper function to convert ObjectIds recursively
            def convert_objectids(obj):
                """Recursively convert ObjectIds to strings."""
                if isinstance(obj, ObjectId):
                    return str(obj)
                elif isinstance(obj, dict):
                    return {k: convert_objectids(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_objectids(item) for item in obj]
                elif isinstance(obj, datetime):
                    return obj.isoformat()
                return obj
            
            # Convert all ObjectIds in the conversation first
            conv = convert_objectids(conv)
            
            # Ensure other_user_id is set correctly (from _id which is the other user's ID)
            if '_id' in conv:
                conv['other_user_id'] = str(conv['_id']) if not isinstance(conv['_id'], str) else conv['_id']
            
            # Convert last_message ObjectIds and datetimes (if not already converted)
            if 'last_message' in conv and conv['last_message']:
                last_msg = conv['last_message']
                # Ensure all ObjectIds are strings
                for key in ['_id', 'from_user_id', 'to_user_id']:
                    if key in last_msg and last_msg[key] is not None:
                        if isinstance(last_msg[key], ObjectId):
                            last_msg[key] = str(last_msg[key])
                        elif not isinstance(last_msg[key], str):
                            try:
                                last_msg[key] = str(last_msg[key])
                            except:
                                pass
                # Convert datetime to ISO string if present
                if 'created_at' in last_msg and isinstance(last_msg['created_at'], datetime):
                    last_msg['created_at'] = last_msg['created_at'].isoformat()
                if 'read_at' in last_msg and isinstance(last_msg['read_at'], datetime):
                    last_msg['read_at'] = last_msg['read_at'].isoformat()
                
                # Also add an 'id' field for frontend compatibility
                if '_id' in last_msg:
                    last_msg['id'] = str(last_msg['_id']) if not isinstance(last_msg['_id'], str) else last_msg['_id']

            # Get other user details (after conversion)
            other_user = user_model.get_user_by_id(conv['other_user_id'])
            if other_user:
                conv['other_user'] = {
                    'id': str(other_user['_id']),
                    'username': other_user['username']
                }
                # Also set username and user_id for frontend compatibility
                conv['username'] = other_user['username']
                conv['user_id'] = str(other_user['_id'])
            else:
                # If user not found, still set basic fields to prevent frontend errors
                # This should not happen, but handle gracefully
                conv['username'] = 'Unknown User'
                conv['user_id'] = str(conv['other_user_id'])

            # Determine if last message is from current user
            if 'last_message' in conv and conv['last_message']:
                conv['last_message']['is_from_me'] = str(conv['last_message']['from_user_id']) == user_id
                
            # Ensure last_message has content field (for GIFs, content might be empty)
            if 'last_message' in conv and conv['last_message']:
                if 'content' not in conv['last_message']:
                    conv['last_message']['content'] = ''
                # For GIF messages, show a preview
                if conv['last_message'].get('message_type') == 'gif' and not conv['last_message'].get('content'):
                    conv['last_message']['content'] = '[GIF]'

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