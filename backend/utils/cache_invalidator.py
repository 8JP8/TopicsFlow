"""
Cache invalidation system with entity relationship tracking.
"""
import logging
from typing import Optional, List
from flask import current_app

logger = logging.getLogger(__name__)


class CacheInvalidator:
    """Handles cache invalidation based on entity relationships."""
    
    def __init__(self, cache=None):
        """
        Initialize cache invalidator.
        
        Args:
            cache: RedisCache instance (None if Redis unavailable)
        """
        self.cache = cache
        
        # Entity relationship map: when entity X is updated, invalidate these patterns
        self.relationships = {
            'user': {
                'direct': ['user:{entity_id}', 'user:list:*'],
                'related': []  # Users don't invalidate other entities
            },
            'topic': {
                'direct': ['topic:{entity_id}', 'topic:list:*'],
                'related': ['post:list:topic_{entity_id}*']  # Invalidate posts list for topic
            },
            'post': {
                'direct': ['post:{entity_id}', 'post:list:*'],
                'related': [
                    'topic:{topic_id}',  # Invalidate topic cache
                    'comment:list:post_{entity_id}*',  # Invalidate comments list
                    'post:list:topic_{topic_id}*'  # Invalidate posts list for topic
                ]
            },
            'comment': {
                'direct': ['comment:{entity_id}', 'comment:list:*'],
                'related': [
                    'post:{post_id}',  # Invalidate post cache
                    'comment:list:post_{post_id}*'  # Invalidate comments list for post
                ]
            },
            'chat_room': {
                'direct': ['chat_room:{entity_id}', 'chat_room:list:*'],
                'related': ['message:list:chat_room_{entity_id}*']
            },
            'message': {
                'direct': ['message:{entity_id}', 'message:list:*'],
                'related': [
                    'chat_room:{chat_room_id}',
                    'message:list:chat_room_{chat_room_id}*'
                ]
            }
        }
    
    def invalidate_entity(self, entity_type: str, entity_id: str, **context) -> int:
        """
        Invalidate cache for a single entity and its direct cache keys.
        
        Args:
            entity_type: Type of entity ('user', 'post', 'comment', etc.)
            entity_id: ID of the entity
            **context: Additional context (e.g., topic_id, post_id for related invalidations)
            
        Returns:
            Number of keys invalidated
        """
        if not self.cache or not self.cache.is_available():
            return 0
        
        invalidated = 0
        
        # Get relationship rules for this entity type
        rules = self.relationships.get(entity_type, {})
        
        # Invalidate direct patterns
        direct_patterns = rules.get('direct', [])
        for pattern in direct_patterns:
            pattern = pattern.format(entity_id=entity_id)
            deleted = self.cache.delete_pattern(pattern)
            invalidated += deleted
            if deleted > 0:
                logger.debug(f"Invalidated {deleted} keys matching pattern: {pattern}")
        
        # Invalidate related patterns (using context)
        related_patterns = rules.get('related', [])
        for pattern in related_patterns:
            # Replace placeholders from context
            try:
                pattern = pattern.format(entity_id=entity_id, **context)
                deleted = self.cache.delete_pattern(pattern)
                invalidated += deleted
                if deleted > 0:
                    logger.debug(f"Invalidated {deleted} keys matching pattern: {pattern}")
            except KeyError:
                # Missing context, skip this pattern
                pass
        
        # Always invalidate the specific entity
        entity_key = f"{entity_type}:{entity_id}"
        if self.cache.delete(entity_key):
            invalidated += 1
            logger.debug(f"Invalidated entity key: {entity_key}")
        
        return invalidated
    
    def invalidate_related(self, entity_type: str, entity_id: str, **context) -> int:
        """
        Invalidate cache for entity and all related entities (cascading).
        
        This invalidates everything that depends on this entity.
        
        Args:
            entity_type: Type of entity
            entity_id: ID of the entity
            **context: Additional context for related invalidations
            
        Returns:
            Number of keys invalidated
        """
        if not self.cache or not self.cache.is_available():
            return 0
        
        invalidated = self.invalidate_entity(entity_type, entity_id, **context)
        
        # Additional cascading logic based on entity type
        if entity_type == 'topic':
            # Invalidate all posts in topic
            invalidated += self.cache.delete_pattern(f"post:list:topic_{entity_id}*")
            invalidated += self.cache.delete_pattern(f"post:topic_{entity_id}*")
        
        elif entity_type == 'post':
            # Invalidate all comments for post
            invalidated += self.cache.delete_pattern(f"comment:list:post_{entity_id}*")
            invalidated += self.cache.delete_pattern(f"comment:post_{entity_id}*")
        
        elif entity_type == 'user':
            # Invalidate all user-related data
            invalidated += self.cache.delete_pattern(f"post:list:user_{entity_id}*")
            invalidated += self.cache.delete_pattern(f"comment:list:user_{entity_id}*")
            invalidated += self.cache.delete_pattern(f"topic:list:user_{entity_id}*")
        
        logger.info(f"Invalidated {invalidated} cache keys for {entity_type}:{entity_id} (cascading)")
        return invalidated
    
    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching a pattern.
        
        Args:
            pattern: Redis key pattern (e.g., 'user:*', 'post:list:*')
            
        Returns:
            Number of keys invalidated
        """
        if not self.cache or not self.cache.is_available():
            return 0
        
        deleted = self.cache.delete_pattern(pattern)
        if deleted > 0:
            logger.debug(f"Invalidated {deleted} keys matching pattern: {pattern}")
        return deleted

    def invalidate_user_notifications(self, user_id: str) -> int:
        """Invalidate all notifications cache for a user."""
        return self.invalidate_pattern(f"notifications:user:{user_id}*")

    def invalidate_admin_reports(self) -> int:
        """Invalidate admin reports cache."""
        return self.invalidate_pattern("admin:reports*")

    def invalidate_admin_tickets(self) -> int:
        """Invalidate admin tickets cache."""
        return self.invalidate_pattern("admin:tickets*")

    def invalidate_admin_banned_users(self) -> int:
        """Invalidate admin banned users cache."""
        return self.invalidate_pattern("admin:users:banned*")

    def invalidate_user_reports(self, user_id: str) -> int:
        """Invalidate user's reports cache."""
        # Pattern matches both user:{id}:reports (new style) and legacy if any
        return self.invalidate_pattern(f"reports:user:{user_id}*")

    def invalidate_user_tickets(self, user_id: str) -> int:
        """Invalidate user's tickets cache."""
        return self.invalidate_pattern(f"tickets:user:{user_id}*")

    def invalidate_user_friends(self, user_id: str) -> int:
        """Invalidate user's friends cache."""
        return self.invalidate_pattern(f"friends:user:{user_id}*")


