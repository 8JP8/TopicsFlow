from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


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
            'banned_users': []  # Users banned from this specific topic
        }

        result = self.collection.insert_one(topic_data)
        return str(result.inserted_id)

    def get_topic_by_id(self, topic_id: str) -> Optional[Dict[str, Any]]:
        """Get topic by ID with owner and moderator details."""
        topic = self.collection.find_one({'_id': ObjectId(topic_id)})
        if topic:
            # Convert ObjectId to string for JSON serialization
            topic['_id'] = str(topic['_id'])
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
        query = {'is_public': True}

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

        # Convert ObjectIds and add owner details
        for topic in topics:
            # Convert all ObjectIds to strings
            topic['_id'] = str(topic['_id'])
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
            return result.modified_count > 0

        return False

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

        # Check if owner
        if topic['owner_id'] == ObjectId(user_id):
            return 3

        # Check if moderator
        for mod in topic.get('moderators', []):
            if mod['user_id'] == ObjectId(user_id):
                return 2

        # Check if member
        if ObjectId(user_id) in topic.get('members', []):
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

    def get_user_topics(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all topics where user is a member."""
        topics = list(self.collection.find({'members': ObjectId(user_id)})
                     .sort([('last_activity', -1)]))

        for topic in topics:
            # Convert all ObjectIds to strings
            topic['_id'] = str(topic['_id'])
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
            
            topic['user_permission_level'] = self.get_user_permission_level(str(topic['_id']), user_id)

        return topics

    def delete_topic(self, topic_id: str, user_id: str) -> bool:
        """Delete a topic (only owner can delete)."""
        result = self.collection.delete_one({
            '_id': ObjectId(topic_id),
            'owner_id': ObjectId(user_id)
        })
        return result.deleted_count > 0