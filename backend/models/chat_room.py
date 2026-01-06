from datetime import datetime
from typing import List, Dict, Optional, Any, Union
from bson import ObjectId
from flask import current_app
from utils.cache_decorator import cache_result


class ChatRoom:
    """ChatRoom model for managing conversations within Topics (Discord/Telegram style)."""

    def __init__(self, db):
        self.db = db
        self.collection = db.chat_rooms

    def create_chat_room(self, topic_id: Optional[str], name: str, description: str, owner_id: str,
                        is_public: bool = True, tags: Optional[List[str]] = None,
                        picture: Optional[str] = None,
                        background_picture: Optional[str] = None,
                        voip_enabled: bool = True) -> str:
        """Create a new conversation (chat room) in a topic or a group chat."""
        chat_room_data = {
            'topic_id': ObjectId(topic_id) if topic_id else None,  # Conversation belongs to a Topic or None for Group Chat
            'name': name,
            'description': description,
            'owner_id': ObjectId(owner_id),
            'moderators': [],  # Owner can add moderators later
            'tags': tags or [],  # Tags for searching/filtering
            'is_public': is_public,
            'picture': picture,  # Chat room picture (displayed in header/list)
            'background_picture': background_picture,  # Background picture (faded behind messages)
            'voip_enabled': voip_enabled,
            'member_count': 1,  # Owner counts as first member
            'members': [ObjectId(owner_id)],
            'banned_users': [],  # Users banned from this chat
            'message_count': 0,
            'created_at': datetime.utcnow(),
            'last_activity': datetime.utcnow()
        }

        result = self.collection.insert_one(chat_room_data)
        conversation_id = str(result.inserted_id)
        
        # Update topic conversation count if topic_id is present
        if topic_id:
            from .topic import Topic
            topic_model = Topic(self.db)
            topic_model.increment_conversation_count(topic_id)
        
        # Invalidate cache
        try:
            cache_invalidator = current_app.config.get('CACHE_INVALIDATOR')
            if cache_invalidator:
                cache_invalidator.invalidate_pattern('chat_room:list:*')
        except Exception:
            pass  # Cache invalidation is optional

        return conversation_id

    @cache_result(ttl=300, key_prefix='chat_room', should_jsonify=False)
    def get_chat_room_by_id(self, room_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific chat room by ID."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if room:
            room['_id'] = str(room['_id'])
            room['id'] = str(room['_id'])
            room['topic_id'] = str(room['topic_id'])
            room['owner_id'] = str(room['owner_id'])
            
            # Resolve images
            from utils.imgbb_upload import resolve_image_content
            if room.get('picture'):
                room['picture'] = resolve_image_content(room['picture'])
            if room.get('background_picture'):
                room['background_picture'] = resolve_image_content(room['background_picture'])
            
            # Convert members list ObjectIds to strings
            if 'members' in room and room['members']:
                room['members'] = [str(member_id) for member_id in room['members']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in room and room['moderators']:
                room['moderators'] = [str(mod_id) for mod_id in room['moderators']]
            
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

        return self._process_rooms_list(rooms, user_id)

    def get_group_chats(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all group chats (no topic) for a user."""
        query = {
            'topic_id': None,
            'members': ObjectId(user_id),
            'is_deleted': {'$ne': True}
        }
        
        rooms = list(self.collection.find(query)
                    .sort([('last_activity', -1)]))
        
        return self._process_rooms_list(rooms, user_id)

    def check_name_unique(self, name: str, topic_id: Optional[str] = None) -> bool:
        """Check if a chat room name is unique within a topic or globally for group chats."""
        query = {
            'name': {'$regex': f'^{name}$', '$options': 'i'},
            'is_deleted': {'$ne': True}
        }
        
        if topic_id:
            query['topic_id'] = ObjectId(topic_id)
        else:
            query['topic_id'] = None
            
        existing = self.collection.find_one(query)
        return existing is None

    def _process_rooms_list(self, rooms: List[Dict[str, Any]], user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Helper to process a list of room documents."""
        from utils.imgbb_upload import resolve_image_content
        # Bulk fetch owners
        owner_ids = set()
        for room in rooms:
            if room.get('owner_id'):
                owner_ids.add(room['owner_id'])
        
        owners_map = {}
        if owner_ids:
            from .user import User
            # Convert to distinct ObjectIds for query
            user_obj_ids = []
            for uid in owner_ids:
                if isinstance(uid, ObjectId):
                     user_obj_ids.append(uid)
                elif ObjectId.is_valid(str(uid)):
                     user_obj_ids.append(ObjectId(str(uid)))
            
            if user_obj_ids:
                users_list = list(self.db.users.find({'_id': {'$in': user_obj_ids}}))
                for u in users_list:
                    owners_map[str(u['_id'])] = u

        for room in rooms:
            room['_id'] = str(room['_id'])
            room['id'] = str(room['_id'])
            room['topic_id'] = str(room['topic_id']) if room.get('topic_id') else None
            room['owner_id'] = str(room['owner_id'])
            
            # Resolve images
            if room.get('picture'):
                room['picture'] = resolve_image_content(room['picture'])
            if room.get('background_picture'):
                room['background_picture'] = resolve_image_content(room['background_picture'])
            
            # Convert deleted_by ObjectId to string if present
            if 'deleted_by' in room and room['deleted_by']:
                if isinstance(room['deleted_by'], ObjectId):
                    room['deleted_by'] = str(room['deleted_by'])
            
            # Check if user is member (before converting members to strings)
            if user_id:
                original_members = room.get('members', [])
                room['user_is_member'] = ObjectId(user_id) in original_members
            else:
                room['user_is_member'] = False
            
            # Convert members list ObjectIds to strings
            if 'members' in room and room['members']:
                room['members'] = [str(member_id) if isinstance(member_id, ObjectId) else member_id for member_id in room['members']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in room and room['moderators']:
                converted_moderators = []
                for mod in room['moderators']:
                    if isinstance(mod, ObjectId):
                        converted_moderators.append(str(mod))
                    elif isinstance(mod, dict):
                        # Handle moderator objects with nested ObjectIds
                        converted_mod = {}
                        for key, value in mod.items():
                            if isinstance(value, ObjectId):
                                converted_mod[key] = str(value)
                            else:
                                converted_mod[key] = value
                        converted_moderators.append(converted_mod)
                    else:
                        converted_moderators.append(mod)
                room['moderators'] = converted_moderators
            
            # Convert banned_users list ObjectIds to strings if present
            if 'banned_users' in room and room['banned_users']:
                room['banned_users'] = [str(ban_id) if isinstance(ban_id, ObjectId) else ban_id for ban_id in room['banned_users']]
            
            # Convert datetime to ISO string
            if 'created_at' in room and isinstance(room['created_at'], datetime):
                room['created_at'] = room['created_at'].isoformat()
            if 'last_activity' in room and isinstance(room['last_activity'], datetime):
                room['last_activity'] = room['last_activity'].isoformat()
            if 'deleted_at' in room and room['deleted_at'] and isinstance(room['deleted_at'], datetime):
                room['deleted_at'] = room['deleted_at'].isoformat()
            if 'permanent_delete_at' in room and room['permanent_delete_at'] and isinstance(room['permanent_delete_at'], datetime):
                room['permanent_delete_at'] = room['permanent_delete_at'].isoformat()
            
            # Get owner details from map
            owner_id = room['owner_id']
            owner = owners_map.get(owner_id)
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
        """Soft delete a chat room (only owner can delete). Requires admin approval."""
        from datetime import timedelta
        
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room or room.get('owner_id') != ObjectId(user_id):
            return False

        permanent_delete_at = datetime.utcnow() + timedelta(days=7)
        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$set': {
                    'is_deleted': True,
                    'deleted_by': ObjectId(user_id),
                    'deleted_at': datetime.utcnow(),
                    'permanent_delete_at': permanent_delete_at,
                    'deletion_status': 'pending',
                    'is_public': False  # Hide from public view while pending
                }
            }
        )

        return result.modified_count > 0
    
    def get_pending_deletions(self) -> List[Dict[str, Any]]:
        """Get all chatrooms pending deletion approval."""
        # First, update any deleted chatrooms without deletion_status to 'pending' (backward compatibility)
        self.collection.update_many(
            {
                'is_deleted': True,
                'deletion_status': {'$exists': False}
            },
            {
                '$set': {
                    'deletion_status': 'pending'
                }
            }
        )
        
        # Find chatrooms that are deleted and have deletion_status='pending'
        rooms = list(self.collection.find({
            'is_deleted': True,
            'deletion_status': 'pending'
        }).sort([('deleted_at', -1)]))
        
        for room in rooms:
            # Convert all ObjectIds to strings
            room['_id'] = str(room['_id'])
            room['id'] = str(room['_id'])
            room['owner_id'] = str(room['owner_id'])
            
            topic_id = room.get('topic_id')
            if topic_id:
                room['topic_id'] = str(topic_id) if isinstance(topic_id, ObjectId) else str(topic_id)
            else:
                room['topic_id'] = ''
            
            deleted_by = room.get('deleted_by')
            if deleted_by:
                room['deleted_by'] = str(deleted_by) if isinstance(deleted_by, ObjectId) else str(deleted_by)
            else:
                room['deleted_by'] = ''
            
            # Convert members list
            if 'members' in room and room['members']:
                room['members'] = [str(m) if isinstance(m, ObjectId) else m for m in room['members']]
            
            # Convert moderators list
            if 'moderators' in room and room['moderators']:
                room['moderators'] = [str(m) if isinstance(m, ObjectId) else m for m in room['moderators']]
            
            # Convert banned_users list
            if 'banned_users' in room and room['banned_users']:
                room['banned_users'] = [str(b) if isinstance(b, ObjectId) else b for b in room['banned_users']]
            
            # Convert datetime fields to ISO strings
            if 'created_at' in room and isinstance(room['created_at'], datetime):
                room['created_at'] = room['created_at'].isoformat()
            if 'last_activity' in room and isinstance(room.get('last_activity'), datetime):
                room['last_activity'] = room['last_activity'].isoformat()
            if 'deleted_at' in room and isinstance(room.get('deleted_at'), datetime):
                room['deleted_at'] = room['deleted_at'].isoformat()
            if 'permanent_delete_at' in room and isinstance(room.get('permanent_delete_at'), datetime):
                room['permanent_delete_at'] = room['permanent_delete_at'].isoformat()
            
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
    
    def approve_chatroom_deletion(self, room_id: str) -> bool:
        """Approve chatroom deletion (admin only)."""
        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$set': {
                    'deletion_status': 'approved'
                }
            }
        )
        return result.modified_count > 0
    
    def reject_chatroom_deletion(self, room_id: str) -> bool:
        """Reject chatroom deletion and restore it (admin only)."""
        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$set': {
                    'is_deleted': False,
                    'deleted_by': None,
                    'deleted_at': None,
                    'permanent_delete_at': None,
                    'deletion_status': 'rejected',
                    'is_public': True
                }
            }
        )
        return result.modified_count > 0

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

    def kick_user_from_chat(self, room_id: str, user_id: str, kicked_by: str) -> bool:
        """Kick a user from a chat room (owner or moderator can kick)."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return False

        # Check permissions
        permission_level = self.get_user_permission_level(room_id, kicked_by)
        if permission_level < 2:  # Only owner (3) or moderator (2) can kick
            return False

        # Cannot kick owner
        if room.get('owner_id') == ObjectId(user_id):
            return False

        # Cannot kick yourself
        if ObjectId(kicked_by) == ObjectId(user_id):
            return False

        # Remove from members and moderators if present
        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$pull': {
                    'members': ObjectId(user_id),
                    'moderators': ObjectId(user_id)
                },
                '$inc': {'member_count': -1 if ObjectId(user_id) in room.get('members', []) else 0}
            }
        )
        return result.modified_count > 0

    def is_user_banned_from_chat(self, room_id: str, user_id: str) -> bool:
        """Check if user is banned from a chat room."""
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return False
        return ObjectId(user_id) in room.get('banned_users', [])

    def update_settings(self, room_id: str, voip_enabled: bool) -> bool:
        """Update chat room settings."""
        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$set': {'voip_enabled': voip_enabled}}
        )
        return result.modified_count > 0

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

    def invite_user(self, room_id: str, invited_user_id: str, invited_by: str) -> Optional[str]:
        """Invite a user to a private chat room.
        Returns: invitation_id on success, None on failure, or specific error strings.
        """
        room = self.collection.find_one({'_id': ObjectId(room_id)})
        if not room:
            return None

        # Check permissions - only owner or moderator can invite
        permission_level = self.get_user_permission_level(room_id, invited_by)
        if permission_level < 2:  # Only owner (3) or moderator (2) can invite
            return None

        # Check if room is public (no need to invite to public rooms)
        if room.get('is_public', True):
            return None

        # Check if user is the owner (owner cannot be invited)
        if room.get('owner_id') == ObjectId(invited_user_id):
            return "is_owner"

        # Check if user is already a member
        if ObjectId(invited_user_id) in room.get('members', []):
            return "already_member"

        # Check if user is banned
        if ObjectId(invited_user_id) in room.get('banned_users', []):
            return "is_banned"

        # Create invitation in invitations collection
        if not hasattr(self.db, 'chat_room_invitations'):
            self.db.chat_room_invitations = self.db.chat_room_invitations

        invitation = {
            'room_id': ObjectId(room_id),
            'invited_user_id': ObjectId(invited_user_id),
            'invited_by': ObjectId(invited_by),
            'status': 'pending',
            'created_at': datetime.utcnow()
        }

        # Check if invitation already exists
        existing = self.db.chat_room_invitations.find_one({
            'room_id': ObjectId(room_id),
            'invited_user_id': ObjectId(invited_user_id),
            'status': 'pending'
        })

        if existing:
            return "already_invited"  # Invitation already exists

        result = self.db.chat_room_invitations.insert_one(invitation)
        return str(result.inserted_id)  # Return invitation ID

    def accept_invitation(self, invitation_id: str, user_id: str) -> bool:
        """Accept a chat room invitation."""
        invitation = self.db.chat_room_invitations.find_one({
            '_id': ObjectId(invitation_id),
            'invited_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        if not invitation:
            return False

        room_id = str(invitation['room_id'])

        # Add user to room
        result = self.collection.update_one(
            {'_id': ObjectId(room_id)},
            {
                '$addToSet': {'members': ObjectId(user_id)},
                '$inc': {'member_count': 1},
                '$set': {'last_activity': datetime.utcnow()}
            }
        )

        if result.modified_count > 0:
            # Mark invitation as accepted
            self.db.chat_room_invitations.update_one(
                {'_id': ObjectId(invitation_id)},
                {'$set': {'status': 'accepted', 'accepted_at': datetime.utcnow()}}
            )
            return True

        return False

    def decline_invitation(self, invitation_id: str, user_id: str) -> bool:
        """Decline a chat room invitation."""
        invitation = self.db.chat_room_invitations.find_one({
            '_id': ObjectId(invitation_id),
            'invited_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        if not invitation:
            return False

        # Mark invitation as declined
        self.db.chat_room_invitations.update_one(
            {'_id': ObjectId(invitation_id)},
            {'$set': {'status': 'declined', 'declined_at': datetime.utcnow()}}
        )
        return True

    def get_pending_invitations(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all pending invitations for a user."""
        invitations = list(self.db.chat_room_invitations.find({
            'invited_user_id': ObjectId(user_id),
            'status': 'pending'
        }).sort([('created_at', -1)]))

        result = []
        for inv in invitations:
            room = self.get_chat_room_by_id(str(inv['room_id']))
            if room:
                from .user import User
                user_model = User(self.db)
                inviter = user_model.get_user_by_id(str(inv['invited_by']))
                
                # Fetch topic data if topic_id exists and is valid
                topic_data = None
                topic_id = room.get('topic_id')
                # Check if topic_id is truthy and not the string 'None'
                if topic_id and topic_id != 'None' and str(topic_id) != 'None':
                    from .topic import Topic
                    topic_model = Topic(self.db)
                    try:
                        topic = topic_model.get_topic_by_id(topic_id)
                        if topic:
                            topic_data = {
                                'id': str(topic.get('_id', topic.get('id', ''))),
                                'title': topic.get('title', 'Unknown Topic')
                            }
                    except Exception:
                        pass  # Invalid topic_id, skip
                
                # Determine if this is a group chat (no topic_id) or a chatroom belonging to a topic
                is_group_chat = not topic_id or topic_id == 'None' or str(topic_id) == 'None'
                
                result.append({
                    'id': str(inv['_id']),
                    'room_id': str(inv['room_id']),
                    'room_name': room.get('name'),
                    'room_description': room.get('description'),
                    'topic_id': None if is_group_chat else str(topic_id),
                    'topic': topic_data,  # Include topic object with title
                    'is_group_chat': is_group_chat,  # Flag to distinguish group chats from topic chatrooms
                    'status': inv.get('status', 'pending'),
                    'invited_by': {
                        'id': str(inv['invited_by']),
                        'username': inviter.get('username') if inviter else 'Unknown'
                    },
                    'created_at': inv['created_at'].isoformat() if isinstance(inv['created_at'], datetime) else inv['created_at']
                })

        return result


