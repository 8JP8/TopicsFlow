from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
from flask import current_app
from utils.cache_decorator import cache_result


class Topic:
    """Topic model for chat topic management."""

    def __init__(self, db):
        self.db = db
        self.collection = db.topics

    def create_topic(self, title: str, description: str, owner_id: str,
                    tags: Optional[List[str]] = None,
                    allow_anonymous: bool = True,
                    require_approval: bool = False) -> str:
        """Create a new chat topic."""
        # Check if topic with same title already exists (case-insensitive)
        existing_topic = self.collection.find_one({
            'title': {'$regex': f'^{title}$', '$options': 'i'},
            'is_deleted': {'$ne': True}  # Exclude deleted topics
        })
        
        if existing_topic:
            raise ValueError(f'Topic with title "{title}" already exists')
        
        topic_data = {
            'title': title,
            'description': description,
            'owner_id': ObjectId(owner_id),
            'moderators': [],  # Owner can add moderators later
            'tags': tags or [],
            'member_count': 1,  # Owner counts as first member
            'is_public': True,  # All topics are public per requirements
            'created_at': datetime.utcnow(),
            'last_activity': datetime.utcnow(),
            'settings': {
                'allow_anonymous': allow_anonymous,
                'require_approval': require_approval
            },
            'members': [ObjectId(owner_id)],  # Track members for permissions
            'banned_users': [],  # Users banned from this specific topic
            'post_count': 0,  # Number of posts in this topic
            'conversation_count': 0  # Number of conversations (Discord-style) in this topic
        }

        result = self.collection.insert_one(topic_data)
        topic_id = str(result.inserted_id)
        
        # Invalidate cache
        try:
            cache_invalidator = current_app.config.get('CACHE_INVALIDATOR')
            if cache_invalidator:
                cache_invalidator.invalidate_pattern('topic:list:*')
        except Exception:
            pass  # Cache invalidation is optional
        
        return topic_id

    @cache_result(ttl=300, key_prefix='topic', should_jsonify=False)
    def get_topic_by_id(self, topic_id: str) -> Optional[Dict[str, Any]]:
        """Get topic by ID with owner and moderator details."""
        topic = self.collection.find_one({'_id': ObjectId(topic_id)})
        if topic:
            # Convert ObjectId to string for JSON serialization
            topic['_id'] = str(topic['_id'])
            topic['id'] = str(topic['_id'])  # Add 'id' field for frontend compatibility
            topic['owner_id'] = str(topic['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in topic and topic['members']:
                topic['members'] = [str(member_id) for member_id in topic['members']]
            
            # Convert banned_users list ObjectIds to strings
            if 'banned_users' in topic and topic['banned_users']:
                topic['banned_users'] = [str(user_id) for user_id in topic['banned_users']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in topic and topic['moderators']:
                for mod in topic['moderators']:
                    if 'user_id' in mod:
                        mod['user_id'] = str(mod['user_id'])
                    if 'added_by' in mod:
                        mod['added_by'] = str(mod['added_by'])

            # Get owner details
            from .user import User
            user_model = User(self.db)
            owner = user_model.get_user_by_id(topic['owner_id'])
            if owner:
                topic['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }

        return topic

    def get_public_topics(self, sort_by: str = 'last_activity',
                         limit: int = 50, offset: int = 0,
                         tags: Optional[List[str]] = None,
                         search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get public topics with sorting and filtering."""
        query = {
            'is_public': True,
            'is_deleted': {'$ne': True}  # Exclude deleted topics
        }

        if tags:
            query['tags'] = {'$in': tags}

        if search:
            query['$or'] = [
                {'title': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}}
            ]

        # Determine sort order
        if sort_by == 'member_count':
            sort_key = ('member_count', -1)
        elif sort_by == 'created_at':
            sort_key = ('created_at', -1)
        else:  # default: last_activity
            sort_key = ('last_activity', -1)

        topics = list(self.collection.find(query)
                     .sort([sort_key])
                     .limit(limit)
                     .skip(offset))

        # Bulk fetch owners
        owner_ids = set()
        for topic in topics:
            if topic.get('owner_id'):
                owner_ids.add(topic['owner_id'])
        
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

        # Convert ObjectIds and add owner details
        for topic in topics:
            # Convert all ObjectIds to strings
            topic['_id'] = str(topic['_id'])
            topic['id'] = str(topic['_id'])  # Add 'id' field for frontend compatibility
            topic['owner_id'] = str(topic['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in topic and topic['members']:
                topic['members'] = [str(member_id) for member_id in topic['members']]
            
            # Convert banned_users list ObjectIds to strings
            if 'banned_users' in topic and topic['banned_users']:
                topic['banned_users'] = [str(user_id) for user_id in topic['banned_users']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in topic and topic['moderators']:
                for mod in topic['moderators']:
                    if 'user_id' in mod:
                        mod['user_id'] = str(mod['user_id'])
                    if 'added_by' in mod:
                        mod['added_by'] = str(mod['added_by'])

            # Get owner details from map
            owner_id = topic['owner_id']
            owner = owners_map.get(owner_id)
            if owner:
                topic['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }

        return topics

    def update_topic(self, topic_id: str, user_id: str, updates: Dict[str, Any]) -> bool:
        """Update topic details (only owner can update)."""
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'owner_id': ObjectId(user_id)
        })

        if not topic:
            return False

        # Allowed fields for update
        allowed_fields = ['title', 'description', 'tags', 'settings']
        update_data = {k: v for k, v in updates.items() if k in allowed_fields}

        if update_data:
            update_data['last_activity'] = datetime.utcnow()
            result = self.collection.update_one(
                {'_id': ObjectId(topic_id)},
                {'$set': update_data}
            )
            
            # Invalidate cache
            if result.modified_count > 0:
                try:
                    cache_invalidator = current_app.config.get('CACHE_INVALIDATOR')
                    if cache_invalidator:
                        cache_invalidator.invalidate_entity('topic', topic_id, topic_id=topic_id)
                except Exception:
                    pass  # Cache invalidation is optional
            
            return result.modified_count > 0

        return False

    def invite_user(self, topic_id: str, invited_user_id: str, invited_by: str) -> Optional[str]:
        """Invite a user to an invite-only topic.
        Returns: invitation_id on success, None on failure, or specific error strings.
        """
        topic = self.collection.find_one({'_id': ObjectId(topic_id)})
        if not topic:
            return None

        # Check if topic requires approval (invite-only)
        if not topic.get('settings', {}).get('require_approval', False):
            return None  # Public topics don't need invitations

        # Check permissions - only owner, moderator, or member can invite
        permission_level = self.get_user_permission_level(topic_id, invited_by)
        if permission_level < 1:  # Must be at least a member
            return None

        # Check if user is the owner (owner cannot be invited)
        if topic.get('owner_id') == ObjectId(invited_user_id):
            return "is_owner"

        # Check if user is already a member
        if ObjectId(invited_user_id) in topic.get('members', []):
            return "already_member"

        # Check if user is banned
        if ObjectId(invited_user_id) in topic.get('banned_users', []):
            return "is_banned"

        # Create invitation in topic_invitations collection
        # Create invitation in topic_invitations collection

        invitation = {
            'topic_id': ObjectId(topic_id),
            'invited_user_id': ObjectId(invited_user_id),
            'invited_by': ObjectId(invited_by),
            'status': 'pending',
            'created_at': datetime.utcnow()
        }

        # Check if invitation already exists
        existing = self.db.topic_invitations.find_one({
            'topic_id': ObjectId(topic_id),
            'invited_user_id': ObjectId(invited_user_id),
            'status': 'pending'
        })

        if existing:
            return "already_invited"  # Invitation already exists

        result = self.db.topic_invitations.insert_one(invitation)
        return str(result.inserted_id)  # Return invitation ID

    def get_user_invitations(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all pending topic invitations for a user."""
        try:
            invitations = list(self.db.topic_invitations.find({
                'invited_user_id': ObjectId(user_id),
                'status': 'pending'
            }).sort([('created_at', -1)]))
        except Exception:
            # Collection might not exist or other DB error
            return []

        result = []
        for invite in invitations:
            try:
                invite['_id'] = str(invite['_id'])
                invite['id'] = str(invite['_id'])
                invite['topic_id'] = str(invite['topic_id'])
                invite['invited_user_id'] = str(invite['invited_user_id'])
                invite['invited_by'] = str(invite['invited_by'])
                
                if 'created_at' in invite and isinstance(invite['created_at'], datetime):
                    invite['created_at'] = invite['created_at'].isoformat()

                # Get topic details
                topic = self.collection.find_one({'_id': ObjectId(invite['topic_id'])})
                if topic:
                    invite['topic'] = {
                        'id': str(topic['_id']),
                        'title': topic.get('title'),
                        'description': topic.get('description'),
                        'member_count': topic.get('member_count', 0)
                    }
                else:
                    # Topic deleted, skip invitation
                    continue
                
                # Get inviter details
                from .user import User
                user_model = User(self.db)
                inviter = user_model.get_user_by_id(invite['invited_by'])
                if inviter:
                    invite['inviter'] = {
                        'id': str(inviter['_id']),
                        'username': inviter.get('username'),
                        'profile_picture': inviter.get('profile_picture')
                    }
                else:
                    invite['inviter'] = {
                         'id': invite['invited_by'],
                         'username': 'Unknown User',
                         'profile_picture': None
                    }
                
                result.append(invite)
            except Exception as e:
                # Log error and skip malformed invitation
                print(f"Error processing invitation {invite.get('_id')}: {str(e)}")
                continue

        return result

    def accept_invitation(self, invitation_id: str, user_id: str) -> bool:
        """Accept a topic invitation."""
        if not hasattr(self.db, 'topic_invitations'):
            return False

        invitation = self.db.topic_invitations.find_one({
            '_id': ObjectId(invitation_id),
            'invited_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        if not invitation:
            return False

        # Add user to topic
        topic_id = str(invitation['topic_id'])
        success = self.add_member(topic_id, user_id)

        if success:
            # Update invitation status
            self.db.topic_invitations.update_one(
                {'_id': ObjectId(invitation_id)},
                {
                    '$set': {
                        'status': 'accepted',
                        'responded_at': datetime.utcnow()
                    }
                }
            )
            return True
        return False

    def decline_invitation(self, invitation_id: str, user_id: str) -> bool:
        """Decline a topic invitation."""
        if not hasattr(self.db, 'topic_invitations'):
            return False

        result = self.db.topic_invitations.update_one(
            {
                '_id': ObjectId(invitation_id),
                'invited_user_id': ObjectId(user_id),
                'status': 'pending'
            },
            {
                '$set': {
                    'status': 'declined',
                    'responded_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    def add_member(self, topic_id: str, user_id: str) -> bool:
        """Add a user to topic members."""
        # Check if user is banned from this topic
        if self.is_user_banned_from_topic(topic_id, user_id):
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {
                '$addToSet': {'members': ObjectId(user_id)},
                '$inc': {'member_count': 1},
                '$set': {'last_activity': datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def remove_member(self, topic_id: str, user_id: str) -> bool:
        """Remove a user from topic members."""
        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {
                '$pull': {'members': ObjectId(user_id)},
                '$inc': {'member_count': -1}
            }
        )
        return result.modified_count > 0

    def is_user_member(self, topic_id: str, user_id: str) -> bool:
        """Check if user is a member of the topic."""
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'members': ObjectId(user_id)
        })
        return topic is not None

    def add_moderator(self, topic_id: str, owner_id: str, moderator_id: str,
                     permissions: List[str]) -> bool:
        """Add a moderator to the topic (only owner can add)."""
        # Verify owner
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'owner_id': ObjectId(owner_id)
        })

        if not topic:
            return False

        moderator_data = {
            'user_id': ObjectId(moderator_id),
            'added_by': ObjectId(owner_id),
            'added_at': datetime.utcnow(),
            'permissions': permissions
        }

        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$addToSet': {'moderators': moderator_data}}
        )
        return result.modified_count > 0

    def remove_moderator(self, topic_id: str, owner_id: str, moderator_id: str) -> bool:
        """Remove a moderator from the topic (only owner can remove)."""
        # Verify owner
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'owner_id': ObjectId(owner_id)
        })

        if not topic:
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$pull': {'moderators': {'user_id': ObjectId(moderator_id)}}}
        )
        return result.modified_count > 0

    def get_moderators(self, topic_id: str) -> List[Dict[str, Any]]:
        """Get all moderators for a topic."""
        topic = self.collection.find_one({'_id': ObjectId(topic_id)})
        if not topic:
            return []

        moderators = []
        for mod in topic.get('moderators', []):
            from .user import User
            user_model = User(self.db)
            user = user_model.get_user_by_id(str(mod['user_id']))
            if user:
                moderators.append({
                    'id': str(user['_id']),
                    'username': user['username'],
                    'added_at': mod['added_at'],
                    'permissions': mod['permissions'],
                    'added_by': str(mod['added_by'])
                })

        return moderators

    def is_user_moderator(self, topic_id: str, user_id: str) -> bool:
        """Check if user is a moderator of the topic."""
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'moderators.user_id': ObjectId(user_id)
        })
        return topic is not None

    def get_user_permission_level(self, topic_id: str, user_id: str) -> int:
        """Get user's permission level in topic: 0=none, 1=member, 2=moderator, 3=owner."""
        topic = self.collection.find_one({'_id': ObjectId(topic_id)})
        if not topic:
            return 0

        return self.calculate_permission_level(topic, user_id)

    def calculate_permission_level(self, topic: Dict[str, Any], user_id: str) -> int:
        """Calculate user's permission level in topic using provided topic data."""
        if not topic:
            return 0

        # Check if owner
        # owner_id might be string or ObjectId depending on source
        owner_id = topic.get('owner_id')
        if str(owner_id) == str(user_id):
            return 3

        # Check if moderator
        # moderators list might contain dicts or IDs
        for mod in topic.get('moderators', []):
            if isinstance(mod, dict):
                mod_id = mod.get('user_id')
            else:
                mod_id = mod

            if str(mod_id) == str(user_id):
                return 2

        # Check if member
        # members is list of IDs
        members = topic.get('members', [])
        # Convert all to strings for comparison
        member_ids = [str(m) for m in members]
        if str(user_id) in member_ids:
            return 1

        return 0

    def transfer_ownership(self, topic_id: str, current_owner_id: str, new_owner_id: str) -> bool:
        """Transfer topic ownership to another user."""
        # Verify current owner
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'owner_id': ObjectId(current_owner_id)
        })

        if not topic:
            return False

        # Add new owner as member if not already
        self.add_member(topic_id, new_owner_id)

        # Transfer ownership
        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {
                '$set': {
                    'owner_id': ObjectId(new_owner_id),
                    'last_activity': datetime.utcnow()
                }
            }
        )

        # Remove old owner from moderators if they were one
        self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$pull': {'moderators': {'user_id': ObjectId(current_owner_id)}}}
        )

        return result.modified_count > 0

    def ban_user_from_topic(self, topic_id: str, user_id: str, banned_by: str) -> bool:
        """Ban a user from a specific topic."""
        # Check if user has permission to ban (owner or moderator)
        permission_level = self.get_user_permission_level(topic_id, banned_by)
        if permission_level < 2:  # Moderator or higher
            return False

        # Remove from members and add to banned list
        self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {
                '$pull': {'members': ObjectId(user_id)},
                '$addToSet': {'banned_users': ObjectId(user_id)},
                '$inc': {'member_count': -1}
            }
        )

        return True

    def unban_user_from_topic(self, topic_id: str, user_id: str, unbanned_by: str) -> bool:
        """Unban a user from a specific topic."""
        # Check if user has permission to unban (owner or moderator)
        permission_level = self.get_user_permission_level(topic_id, unbanned_by)
        if permission_level < 2:  # Moderator or higher
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$pull': {'banned_users': ObjectId(user_id)}}
        )

        return result.modified_count > 0

    def is_user_banned_from_topic(self, topic_id: str, user_id: str) -> bool:
        """Check if user is banned from a specific topic."""
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'banned_users': ObjectId(user_id)
        })
        return topic is not None

    def update_last_activity(self, topic_id: str) -> None:
        """Update the last activity timestamp for a topic."""
        self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$set': {'last_activity': datetime.utcnow()}}
        )

    @cache_result(ttl=300, key_prefix='topic', should_jsonify=False)
    def get_user_topics(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all topics where user is a member."""
        topics = list(self.collection.find({'members': ObjectId(user_id)})
                     .sort([('last_activity', -1)]))

        for topic in topics:
            # Convert all ObjectIds to strings
            topic['_id'] = str(topic['_id'])
            topic['id'] = str(topic['_id'])  # Add 'id' field for frontend compatibility
            topic['owner_id'] = str(topic['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in topic and topic['members']:
                topic['members'] = [str(member_id) for member_id in topic['members']]
            
            # Convert banned_users list ObjectIds to strings
            if 'banned_users' in topic and topic['banned_users']:
                topic['banned_users'] = [str(user_id) for user_id in topic['banned_users']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in topic and topic['moderators']:
                for mod in topic['moderators']:
                    if 'user_id' in mod:
                        mod['user_id'] = str(mod['user_id'])
                    if 'added_by' in mod:
                        mod['added_by'] = str(mod['added_by'])
            
            topic['user_permission_level'] = self.calculate_permission_level(topic, user_id)

        return topics

    def add_tags_to_topic(self, topic_id: str, tags: List[str]) -> bool:
        """Add tags to a topic (non-duplicate)."""
        if not tags:
            return False
        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$addToSet': {'tags': {'$each': tags}}}
        )
        return result.modified_count > 0

    def increment_post_count(self, topic_id: str) -> None:
        """Increment the post count for a topic."""
        self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$inc': {'post_count': 1}, '$set': {'last_activity': datetime.utcnow()}}
        )

    def decrement_post_count(self, topic_id: str) -> None:
        """Decrement the post count for a topic."""
        self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$inc': {'post_count': -1}}
        )

    def increment_conversation_count(self, topic_id: str) -> None:
        """Increment the conversation count for a topic."""
        self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$inc': {'conversation_count': 1}}
        )

    def decrement_conversation_count(self, topic_id: str) -> None:
        """Decrement the conversation count for a topic."""
        self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {'$inc': {'conversation_count': -1}}
        )

    def delete_topic(self, topic_id: str, user_id: str) -> bool:
        """Soft delete a topic (only owner can delete). Requires admin approval."""
        from datetime import timedelta
        
        topic = self.collection.find_one({
            '_id': ObjectId(topic_id),
            'owner_id': ObjectId(user_id)
        })
        
        if not topic:
            return False
        
        # Soft delete with pending admin approval
        permanent_delete_at = datetime.utcnow() + timedelta(days=7)
        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {
                '$set': {
                    'is_deleted': True,
                    'deleted_by': ObjectId(user_id),
                    'deleted_at': datetime.utcnow(),
                    'permanent_delete_at': permanent_delete_at,
                    'deletion_status': 'pending',  # pending, approved, rejected
                    'is_public': False  # Hide from public view while pending
                }
            }
        )
        return result.modified_count > 0
    
    def approve_topic_deletion(self, topic_id: str) -> bool:
        """Approve topic deletion (admin only)."""
        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
            {
                '$set': {
                    'deletion_status': 'approved'
                }
            }
        )
        return result.modified_count > 0
    
    def reject_topic_deletion(self, topic_id: str) -> bool:
        """Reject topic deletion and restore it (admin only)."""
        result = self.collection.update_one(
            {'_id': ObjectId(topic_id)},
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
    
    def get_pending_deletions(self) -> List[Dict[str, Any]]:
        """Get all topics pending deletion approval."""
        # First, update any deleted topics without deletion_status to 'pending' (backward compatibility)
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
        
        # Find topics that are deleted and have deletion_status='pending'
        topics = list(self.collection.find({
            'is_deleted': True,
            'deletion_status': 'pending'
        }).sort([('deleted_at', -1)]))
        
        # Bulk fetch owners
        owner_ids = set()
        for topic in topics:
            if topic.get('owner_id'):
                owner_ids.add(topic['owner_id'])
        
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

        for topic in topics:
            # Convert all ObjectIds to strings
            topic['_id'] = str(topic['_id'])
            topic['id'] = str(topic['_id'])
            topic['owner_id'] = str(topic['owner_id'])
            
            deleted_by = topic.get('deleted_by')
            if deleted_by:
                topic['deleted_by'] = str(deleted_by) if isinstance(deleted_by, ObjectId) else str(deleted_by)
            else:
                topic['deleted_by'] = ''
            
            # Convert members list
            if 'members' in topic and topic['members']:
                topic['members'] = [str(m) if isinstance(m, ObjectId) else m for m in topic['members']]
            
            # Convert moderators list
            if 'moderators' in topic and topic['moderators']:
                for mod in topic['moderators']:
                    if isinstance(mod, dict):
                        if 'user_id' in mod:
                            mod['user_id'] = str(mod['user_id']) if isinstance(mod['user_id'], ObjectId) else str(mod['user_id'])
                        if 'added_by' in mod:
                            mod['added_by'] = str(mod['added_by']) if isinstance(mod['added_by'], ObjectId) else str(mod['added_by'])
                    elif isinstance(mod, ObjectId):
                        # If it's just an ObjectId, convert it
                        idx = topic['moderators'].index(mod)
                        topic['moderators'][idx] = str(mod)
            
            # Convert banned_users list
            if 'banned_users' in topic and topic['banned_users']:
                topic['banned_users'] = [str(b) if isinstance(b, ObjectId) else b for b in topic['banned_users']]
            
            # Convert datetime fields to ISO strings
            if 'created_at' in topic and isinstance(topic['created_at'], datetime):
                topic['created_at'] = topic['created_at'].isoformat()
            if 'last_activity' in topic and isinstance(topic['last_activity'], datetime):
                topic['last_activity'] = topic['last_activity'].isoformat()
            if 'deleted_at' in topic and isinstance(topic.get('deleted_at'), datetime):
                topic['deleted_at'] = topic['deleted_at'].isoformat()
            if 'permanent_delete_at' in topic and isinstance(topic.get('permanent_delete_at'), datetime):
                topic['permanent_delete_at'] = topic['permanent_delete_at'].isoformat()
            
            # Get owner details form map
            owner_id = topic['owner_id']
            owner = owners_map.get(owner_id)
            if owner:
                topic['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }
        
        return topics