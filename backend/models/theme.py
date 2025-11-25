from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class Theme:
    """Theme model for managing discussion themes within Topics (Reddit-style)."""

    def __init__(self, db):
        self.db = db
        self.collection = db.themes

    def create_theme(self, topic_id: str, title: str, description: str, owner_id: str,
                    tags: Optional[List[str]] = None,
                    allow_anonymous: bool = True,
                    require_approval: bool = False) -> str:
        """Create a new theme within a topic."""
        theme_data = {
            'topic_id': ObjectId(topic_id),  # Theme belongs to a Topic
            'title': title,
            'description': description,
            'owner_id': ObjectId(owner_id),
            'moderators': [],  # Owner can add moderators later
            'tags': tags or [],
            'member_count': 1,  # Owner counts as first member
            'is_public': True,  # All themes are public per requirements
            'created_at': datetime.utcnow(),
            'last_activity': datetime.utcnow(),
            'settings': {
                'allow_anonymous': allow_anonymous,
                'require_approval': require_approval
            },
            'members': [ObjectId(owner_id)],  # Track members for permissions
            'banned_users': [],  # Users banned from this specific theme
            'post_count': 0  # Number of posts in this theme (Reddit-style)
        }

        result = self.collection.insert_one(theme_data)
        theme_id = str(result.inserted_id)
        
        # Update topic theme count
        from .topic import Topic
        topic_model = Topic(self.db)
        topic_model.increment_theme_count(topic_id)
        
        return theme_id

    def get_theme_by_id(self, theme_id: str) -> Optional[Dict[str, Any]]:
        """Get theme by ID with owner and moderator details."""
        theme = self.collection.find_one({'_id': ObjectId(theme_id)})
        if theme:
            # Convert ObjectId to string for JSON serialization
            theme['_id'] = str(theme['_id'])
            theme['id'] = str(theme['_id'])  # Also add 'id' field for frontend compatibility
            # Handle migration: support both topic_id (new) and old structure
            if 'topic_id' in theme:
                theme['topic_id'] = str(theme['topic_id'])
            theme['owner_id'] = str(theme['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in theme and theme['members']:
                theme['members'] = [str(member_id) for member_id in theme['members']]
            
            # Convert banned_users list ObjectIds to strings
            if 'banned_users' in theme and theme['banned_users']:
                theme['banned_users'] = [str(user_id) for user_id in theme['banned_users']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in theme and theme['moderators']:
                for mod in theme['moderators']:
                    if 'user_id' in mod:
                        mod['user_id'] = str(mod['user_id'])
                    if 'added_by' in mod:
                        mod['added_by'] = str(mod['added_by'])

            # Get owner details
            from .user import User
            user_model = User(self.db)
            owner = user_model.get_user_by_id(theme['owner_id'])
            if owner:
                theme['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }

        return theme

    def get_themes_by_topic(self, topic_id: str, sort_by: str = 'last_activity',
                           limit: int = 50, offset: int = 0,
                           tags: Optional[List[str]] = None,
                           search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get themes within a topic with sorting and filtering (Reddit-style)."""
        query = {'topic_id': ObjectId(topic_id), 'is_public': True}

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
        elif sort_by == 'post_count':
            sort_key = ('post_count', -1)
        else:  # default: last_activity
            sort_key = ('last_activity', -1)

        themes = list(self.collection.find(query)
                     .sort([sort_key])
                     .limit(limit)
                     .skip(offset))

        # Convert ObjectIds and add owner details
        for theme in themes:
            # Convert all ObjectIds to strings
            theme['_id'] = str(theme['_id'])
            theme['id'] = str(theme['_id'])
            # Handle migration: support both topic_id (new) and old structure
            if 'topic_id' in theme:
                theme['topic_id'] = str(theme['topic_id'])
            theme['owner_id'] = str(theme['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in theme and theme['members']:
                theme['members'] = [str(member_id) for member_id in theme['members']]
            
            # Convert banned_users list ObjectIds to strings
            if 'banned_users' in theme and theme['banned_users']:
                theme['banned_users'] = [str(user_id) for user_id in theme['banned_users']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in theme and theme['moderators']:
                for mod in theme['moderators']:
                    if 'user_id' in mod:
                        mod['user_id'] = str(mod['user_id'])
                    if 'added_by' in mod:
                        mod['added_by'] = str(mod['added_by'])

            # Get owner details
            from .user import User
            user_model = User(self.db)
            owner = user_model.get_user_by_id(theme['owner_id'])
            if owner:
                theme['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }

        return themes

    def update_theme(self, theme_id: str, user_id: str, updates: Dict[str, Any]) -> bool:
        """Update theme details (only owner can update)."""
        theme = self.collection.find_one({
            '_id': ObjectId(theme_id),
            'owner_id': ObjectId(user_id)
        })

        if not theme:
            return False

        # Allowed fields for update
        allowed_fields = ['title', 'description', 'tags', 'settings']
        update_data = {k: v for k, v in updates.items() if k in allowed_fields}

        if update_data:
            update_data['last_activity'] = datetime.utcnow()
            result = self.collection.update_one(
                {'_id': ObjectId(theme_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0

        return False

    def add_member(self, theme_id: str, user_id: str) -> bool:
        """Add a user to theme members."""
        # Check if user is banned from this theme
        if self.is_user_banned_from_theme(theme_id, user_id):
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {
                '$addToSet': {'members': ObjectId(user_id)},
                '$inc': {'member_count': 1},
                '$set': {'last_activity': datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def remove_member(self, theme_id: str, user_id: str) -> bool:
        """Remove a user from theme members."""
        result = self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {
                '$pull': {'members': ObjectId(user_id)},
                '$inc': {'member_count': -1}
            }
        )
        return result.modified_count > 0

    def is_user_member(self, theme_id: str, user_id: str) -> bool:
        """Check if user is a member of the theme."""
        theme = self.collection.find_one({
            '_id': ObjectId(theme_id),
            'members': ObjectId(user_id)
        })
        return theme is not None

    def add_moderator(self, theme_id: str, owner_id: str, moderator_id: str,
                     permissions: List[str]) -> bool:
        """Add a moderator to the theme (only owner can add)."""
        # Verify owner
        theme = self.collection.find_one({
            '_id': ObjectId(theme_id),
            'owner_id': ObjectId(owner_id)
        })

        if not theme:
            return False

        moderator_data = {
            'user_id': ObjectId(moderator_id),
            'added_by': ObjectId(owner_id),
            'added_at': datetime.utcnow(),
            'permissions': permissions
        }

        result = self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$addToSet': {'moderators': moderator_data}}
        )
        return result.modified_count > 0

    def remove_moderator(self, theme_id: str, owner_id: str, moderator_id: str) -> bool:
        """Remove a moderator from the theme (only owner can remove)."""
        # Verify owner
        theme = self.collection.find_one({
            '_id': ObjectId(theme_id),
            'owner_id': ObjectId(owner_id)
        })

        if not theme:
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$pull': {'moderators': {'user_id': ObjectId(moderator_id)}}}
        )
        return result.modified_count > 0

    def get_moderators(self, theme_id: str) -> List[Dict[str, Any]]:
        """Get all moderators for a theme."""
        theme = self.collection.find_one({'_id': ObjectId(theme_id)})
        if not theme:
            return []

        moderators = []
        for mod in theme.get('moderators', []):
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

    def is_user_moderator(self, theme_id: str, user_id: str) -> bool:
        """Check if user is a moderator of the theme."""
        theme = self.collection.find_one({
            '_id': ObjectId(theme_id),
            'moderators.user_id': ObjectId(user_id)
        })
        return theme is not None

    def get_user_permission_level(self, theme_id: str, user_id: str) -> int:
        """Get user's permission level in theme: 0=none, 1=member, 2=moderator, 3=owner."""
        theme = self.collection.find_one({'_id': ObjectId(theme_id)})
        if not theme:
            return 0

        # Check if owner
        if theme['owner_id'] == ObjectId(user_id):
            return 3

        # Check if moderator
        for mod in theme.get('moderators', []):
            if mod['user_id'] == ObjectId(user_id):
                return 2

        # Check if member
        if ObjectId(user_id) in theme.get('members', []):
            return 1

        return 0

    def transfer_ownership(self, theme_id: str, current_owner_id: str, new_owner_id: str) -> bool:
        """Transfer theme ownership to another user."""
        # Verify current owner
        theme = self.collection.find_one({
            '_id': ObjectId(theme_id),
            'owner_id': ObjectId(current_owner_id)
        })

        if not theme:
            return False

        # Add new owner as member if not already
        self.add_member(theme_id, new_owner_id)

        # Transfer ownership
        result = self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {
                '$set': {
                    'owner_id': ObjectId(new_owner_id),
                    'last_activity': datetime.utcnow()
                }
            }
        )

        # Remove old owner from moderators if they were one
        self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$pull': {'moderators': {'user_id': ObjectId(current_owner_id)}}}
        )

        return result.modified_count > 0

    def ban_user_from_theme(self, theme_id: str, user_id: str, banned_by: str) -> bool:
        """Ban a user from a specific theme."""
        # Check if user has permission to ban (owner or moderator)
        permission_level = self.get_user_permission_level(theme_id, banned_by)
        if permission_level < 2:  # Moderator or higher
            return False

        # Remove from members and add to banned list
        self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {
                '$pull': {'members': ObjectId(user_id)},
                '$addToSet': {'banned_users': ObjectId(user_id)},
                '$inc': {'member_count': -1}
            }
        )

        return True

    def unban_user_from_theme(self, theme_id: str, user_id: str, unbanned_by: str) -> bool:
        """Unban a user from a specific theme."""
        # Check if user has permission to unban (owner or moderator)
        permission_level = self.get_user_permission_level(theme_id, unbanned_by)
        if permission_level < 2:  # Moderator or higher
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$pull': {'banned_users': ObjectId(user_id)}}
        )

        return result.modified_count > 0

    def is_user_banned_from_theme(self, theme_id: str, user_id: str) -> bool:
        """Check if user is banned from a specific theme."""
        theme = self.collection.find_one({
            '_id': ObjectId(theme_id),
            'banned_users': ObjectId(user_id)
        })
        return theme is not None

    def update_last_activity(self, theme_id: str) -> None:
        """Update the last activity timestamp for a theme."""
        self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$set': {'last_activity': datetime.utcnow()}}
        )

    def increment_post_count(self, theme_id: str) -> None:
        """Increment the post count for a theme."""
        self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$inc': {'post_count': 1}, '$set': {'last_activity': datetime.utcnow()}}
        )

    def decrement_post_count(self, theme_id: str) -> None:
        """Decrement the post count for a theme."""
        self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$inc': {'post_count': -1}}
        )

    def increment_chat_room_count(self, theme_id: str) -> None:
        """Increment the chat room count for a theme."""
        self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$inc': {'chat_room_count': 1}}
        )

    def decrement_chat_room_count(self, theme_id: str) -> None:
        """Decrement the chat room count for a theme."""
        self.collection.update_one(
            {'_id': ObjectId(theme_id)},
            {'$inc': {'chat_room_count': -1}}
        )

    def get_user_themes(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all themes where user is a member."""
        themes = list(self.collection.find({'members': ObjectId(user_id)})
                     .sort([('last_activity', -1)]))

        for theme in themes:
            # Convert all ObjectIds to strings
            theme['_id'] = str(theme['_id'])
            theme['id'] = str(theme['_id'])
            theme['owner_id'] = str(theme['owner_id'])
            
            # Convert members list ObjectIds to strings
            if 'members' in theme and theme['members']:
                theme['members'] = [str(member_id) for member_id in theme['members']]
            
            # Convert banned_users list ObjectIds to strings
            if 'banned_users' in theme and theme['banned_users']:
                theme['banned_users'] = [str(user_id) for user_id in theme['banned_users']]
            
            # Convert moderators list ObjectIds to strings
            if 'moderators' in theme and theme['moderators']:
                for mod in theme['moderators']:
                    if 'user_id' in mod:
                        mod['user_id'] = str(mod['user_id'])
                    if 'added_by' in mod:
                        mod['added_by'] = str(mod['added_by'])
            
            theme['user_permission_level'] = self.get_user_permission_level(str(theme['_id']), user_id)

        return themes

    def delete_theme(self, theme_id: str, user_id: str) -> bool:
        """Delete a theme (only owner can delete)."""
        result = self.collection.delete_one({
            '_id': ObjectId(theme_id),
            'owner_id': ObjectId(user_id)
        })
        return result.deleted_count > 0

