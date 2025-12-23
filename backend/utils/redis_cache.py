"""
Redis cache utility with automatic fallback to database queries when Redis is unavailable.
"""
import json
import logging
import hashlib
from typing import Any, Optional
import redis

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis cache wrapper with graceful fallback when Redis is unavailable."""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None, available: bool = False):
        """
        Initialize Redis cache.
        
        Args:
            redis_client: Redis client instance (None if Redis unavailable)
            available: Whether Redis is currently available
        """
        self.client = redis_client
        self._available = available
        self._last_error = None
    
    def is_available(self) -> bool:
        """Check if Redis is currently available."""
        if not self.client:
            return False
        
        # Test connection if we think it's available
        if self._available:
            try:
                self.client.ping()
                return True
            except Exception as e:
                self._available = False
                self._last_error = e
                logger.error("Redis cache operation failed. Querying database directly.")
                return False
        
        return False
    
    def _handle_error(self, operation: str, error: Exception):
        """Handle Redis errors gracefully."""
        self._available = False
        self._last_error = error
        logger.error(f"Redis cache {operation} failed. Querying database directly. Error: {error}")
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get cached value.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value (deserialized) or None if not found or Redis unavailable
        """
        if not self.is_available():
            return None
        
        try:
            value = self.client.get(key)
            if value is None:
                return None
            
            # Deserialize JSON
            if isinstance(value, bytes):
                value = value.decode('utf-8')
            
            return json.loads(value)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to deserialize cache value for key {key}: {e}")
            return None
        except Exception as e:
            self._handle_error("get", e)
            return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Set cached value with TTL.
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time to live in seconds (default: 5 minutes)
            
        Returns:
            True if successful, False otherwise (silently fails if Redis unavailable)
        """
        if not self.is_available():
            return False
        
        try:
            # Serialize to JSON
            serialized = json.dumps(value, default=str)  # default=str handles datetime, ObjectId, etc.
            self.client.setex(key, ttl, serialized)
            return True
        except (TypeError, ValueError) as e:
            logger.warning(f"Failed to serialize cache value for key {key}: {e}")
            return False
        except Exception as e:
            self._handle_error("set", e)
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete single cache key.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if successful, False otherwise (silently fails if Redis unavailable)
        """
        if not self.is_available():
            return False
        
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            self._handle_error("delete", e)
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.
        
        Args:
            pattern: Redis key pattern (e.g., 'user:*', 'post:list:*')
            
        Returns:
            Number of keys deleted (0 if Redis unavailable)
        """
        if not self.is_available():
            return 0
        
        try:
            # Use SCAN to find all matching keys (more efficient than KEYS)
            deleted = 0
            cursor = 0
            while True:
                cursor, keys = self.client.scan(cursor, match=pattern, count=100)
                if keys:
                    deleted += self.client.delete(*keys)
                if cursor == 0:
                    break
            return deleted
        except Exception as e:
            self._handle_error("delete_pattern", e)
            return 0
    
    def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.
        
        Args:
            key: Cache key to check
            
        Returns:
            True if key exists, False otherwise (returns False if Redis unavailable)
        """
        if not self.is_available():
            return False
        
        try:
            return bool(self.client.exists(key))
        except Exception as e:
            self._handle_error("exists", e)
            return False
    
    def clear(self) -> bool:
        """
        Clear all cache (admin/debug only).
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available():
            logger.warning("Cannot clear cache: Redis unavailable")
            return False
        
        try:
            self.client.flushdb()
            logger.warning("Cache cleared (all keys deleted)")
            return True
        except Exception as e:
            self._handle_error("clear", e)
            return False
    
    def update_availability(self, available: bool):
        """Update Redis availability status (called when connection status changes)."""
        if available != self._available:
            if available:
                logger.info("Redis connection restored. Resuming cache operations.")
            else:
                logger.error("Redis connection lost. Falling back to direct database queries.")
            self._available = available

