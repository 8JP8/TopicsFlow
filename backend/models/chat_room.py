from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class ChatRoom:
    """ChatRoom model for managing conversations within Topics (Discord/Telegram style)."""

    def __init__(self, db):
        self.db = db
        self.collection = db.chat_rooms

    def create_chat_room(self, topic_id: str, name: str, description: str, owner_id: str,
                        is_public: bool = True, tags: Optional[List[str]] = None) -> str:
        """Create a new conversation (chat room) in a topic."""
        chat_room_data = {
            'topic_id': ObjectId(topic_id),  # Conversation belongs to a Topic
            'name': name,
            'description': description,
            'owner_id': ObjectId(owner_id),
            'moderators': [],  # Owner can add moderators later
            'tags': tags or [],  # Tags for searching/filtering
            'is_public': is_public,
            'member_count': 1,  # Owner counts as first member
            'members': [ObjectId(owner_id)],
            'banned_users': [],  # Users banned from this chat
            'message_count': 0,
            'created_at': datetime.utcnow(),
            'last_activity': datetime.utcnow()
        }

        result = self.collection.insert_one(chat_room_data)
        conversation_id = str(result.inserted_id)
        
        # Update topic conversation count
        from .topic import Topic
        topic_model = Topic(self.db)
        topic_model.increment_conversation_count(topic_id)

        return conversation_id

    def get_chat_room_by_id(self, room_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific chat room by ID."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if room:
            room['_id'] = str(room['_id'])
            room['id'] = str(room['_id'])
            # Handle migration: support both topic_id (new) and theme_id (old)
            if 'topic_id' in room:
                room['topic_id'] = str(room['topic_id'])
            elif 'theme_id' in room:
                room['topic_id'] = str(room['theme_id'])
                del room['theme_id']
            room['owner_id'] = str(room['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in room and room['members']:
                room['members'] = [str(member_id) for member_id in room['members']]
            
            # Convert datetime to ISO string
            if 'created_at' in room and isinstance(room['created_at'], datetime):
                room['created_at'] = room['created_at'].isoformat()
            if 'last_activity' in room and isinstance(room['last_activity'], datetime):
                room['last_activity'] = room['last_activity'].isoformat()
            
            # Get owner details
            from .user import User
            user_model = User(self.db)
            owner = user_model.get_user_by_id(room['owner_id'])
            if owner:
                room['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }

        return room

    def get_chat_rooms_by_topic(self, topic_id: str, user_id: Optional[str] = None,
                                tags: Optional[List[str]] = None,
                                search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all conversations (chat rooms) for a topic with optional filtering by tags and search."""
        query = {'topic_id': ObjectId(topic_id)}
        
        # If user is provided, show public rooms and rooms user is member of
        if user_id:
            query['$or'] = [
                {'is_public': True},
                {'members': ObjectId(user_id)}
            ]
        else:
            query['is_public'] = True
        
        # Filter by tags if provided
        if tags:
            query['tags'] = {'$in': tags}
        
        # Search by name or description
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}}
            ]
            # If we already have $or for user filtering, combine them
            if '$or' in query and isinstance(query['$or'], list) and len(query['$or']) == 2:
                # Combine user access with search
                user_access = query['$or']
                search_conditions = [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'description': {'$regex': search, '$options': 'i'}}
                ]
                query['$and'] = [
                    {'$or': user_access},
                    {'$or': search_conditions}
                ]
                del query['$or']

        rooms = list(self.collection.find(query)
                    .sort([('last_activity', -1)]))

        for room in rooms:
            room['_id'] = str(room['_id'])
            room['id'] = str(room['_id'])
            room['topic_id'] = str(room.get('topic_id', room.get('theme_id', '')))
            if 'theme_id' in room:
                del room['theme_id']  # Remove old field
            room['owner_id'] = str(room['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in room and room['members']:
                room['members'] = [str(member_id) for member_id in room['members']]
            
            # Check if user is member
            if user_id:
                room['user_is_member'] = ObjectId(user_id) in room.get('members', [])
            else:
                room['user_is_member'] = False
            
            # Convert datetime to ISO string
            if 'created_at' in room and isinstance(room['created_at'], datetime):
                room['created_at'] = room['created_at'].isoformat()
            if 'last_activity' in room and isinstance(room['last_activity'], datetime):
                room['last_activity'] = room['last_activity'].isoformat()
            
            # Get owner details
            from .user import User
            user_model = User(self.db)
            owner = user_model.get_user_by_id(room['owner_id'])
            if owner:
                room['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }

        return rooms

    def join_chat_room(self, room_id: str, user_id: str) -> bool:
        """Join a chat room."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return False

        # Check if room is public or user is already a member
        if not room.get('is_public', True) and ObjectId(user_id) not in room.get('members', []):
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$addToSet': {'members': ObjectId(user_id)},
                '$inc': {'member_count': 1},
                '$set': {'last_activity': datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def leave_chat_room(self, room_id: str, user_id: str) -> bool:
        """Leave a chat room."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return False

        # Owner cannot leave their own room
        if room.get('owner_id') == ObjectId(user_id):
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$pull': {'members': ObjectId(user_id)},
                '$inc': {'member_count': -1}
            }
        )
        return result.modified_count > 0

    def is_user_member(self, room_id: str, user_id: str) -> bool:
        """Check if user is a member of the chat room."""
        room = self.collection.find_one({
            '_id': ObjectId(room_id),
            'members': ObjectId(user_id)
        })
        return room is not None

    def update_last_activity(self, room_id: str) -> None:
        """Update the last activity timestamp for a chat room."""
        self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$set': {'last_activity': datetime.utcnow()}}
        )

    def increment_message_count(self, room_id: str) -> None:
        """Increment the message count for a chat room."""
        self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$inc': {'message_count': 1}, '$set': {'last_activity': datetime.utcnow()}}
        )

    def delete_chat_room(self, room_id: str, user_id: str) -> bool:
        """Delete a chat room (only owner can delete)."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room or room.get('owner_id') != ObjectId(user_id):
            return False

        result = self.collection.delete_one({'_id': ObjectId(room_id)})
        
        if result.deleted_count > 0:
            # Decrement topic conversation count
            from .topic import Topic
            topic_model = Topic(self.db)
            topic_id = str(room.get('topic_id', room.get('theme_id', '')))
            topic_model.decrement_conversation_count(topic_id)

        return result.deleted_count > 0

    def add_moderator(self, room_id: str, owner_id: str, moderator_id: str) -> bool:
        """Add a moderator to a chat room (only owner can add)."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room or room.get('owner_id') != ObjectId(owner_id):
            return False

        # Check if already a moderator
        moderators = room.get('moderators', [])
        if ObjectId(moderator_id) in moderators:
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$addToSet': {'moderators': ObjectId(moderator_id)}}
        )
        return result.modified_count > 0

    def remove_moderator(self, room_id: str, owner_id: str, moderator_id: str) -> bool:
        """Remove a moderator from a chat room (only owner can remove)."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room or room.get('owner_id') != ObjectId(owner_id):
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$pull': {'moderators': ObjectId(moderator_id)}}
        )
        return result.modified_count > 0

    def ban_user_from_chat(self, room_id: str, user_id: str, banned_by: str) -> bool:
        """Ban a user from a chat room (owner or moderator can ban)."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return False

        # Check permissions
        permission_level = self.get_user_permission_level(room_id, banned_by)
        if permission_level < 2:  # Only owner (3) or moderator (2) can ban
            return False

        # Cannot ban owner
        if room.get('owner_id') == ObjectId(user_id):
            return False

        # Remove from members if present
        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$addToSet': {'banned_users': ObjectId(user_id)},
                '$pull': {'members': ObjectId(user_id)},
                '$inc': {'member_count': -1 if ObjectId(user_id) in room.get('members', []) else 0}
            }
        )
        return result.modified_count > 0

    def unban_user_from_chat(self, room_id: str, user_id: str, unbanned_by: str) -> bool:
        """Unban a user from a chat room (owner or moderator can unban)."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return False

        # Check permissions
        permission_level = self.get_user_permission_level(room_id, unbanned_by)
        if permission_level < 2:  # Only owner (3) or moderator (2) can unban
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$pull': {'banned_users': ObjectId(user_id)}}
        )
        return result.modified_count > 0

    def is_user_banned_from_chat(self, room_id: str, user_id: str) -> bool:
        """Check if user is banned from a chat room."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return False
        return ObjectId(user_id) in room.get('banned_users', [])

    def get_user_permission_level(self, room_id: str, user_id: str) -> int:
        """Get user permission level in a chat room.
        Returns: 0 = no access, 1 = member, 2 = moderator, 3 = owner
        """
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return 0

        # Owner
        if room.get('owner_id') == ObjectId(user_id):
            return 3

        # Moderator
        if ObjectId(user_id) in room.get('moderators', []):
            return 2

        # Member
        if ObjectId(user_id) in room.get('members', []):
            return 1

        # No access
        return 0

