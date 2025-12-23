"""
Cache decorator for automatically caching function results.
"""
import functools
import hashlib
import json
import logging
from typing import Any, Callable, Optional
from flask import current_app

logger = logging.getLogger(__name__)


def _generate_cache_key(key_prefix: str, func_name: str, args: tuple, kwargs: dict) -> str:
    """
    Generate cache key from function name and arguments.
    
    Args:
        key_prefix: Prefix for cache key (e.g., 'user', 'post')
        func_name: Function name
        args: Function positional arguments
        kwargs: Function keyword arguments
        
    Returns:
        Cache key string
    """
    # Filter out non-serializable args/kwargs and create hash
    key_parts = [key_prefix, func_name]
    
    # Add args (skip self if present)
    for arg in args:
        if isinstance(arg, (str, int, float, bool, type(None))):
            key_parts.append(str(arg))
        elif hasattr(arg, '__str__'):
            key_parts.append(str(arg))
    
    # Add kwargs (sorted for consistency)
    for k, v in sorted(kwargs.items()):
        if isinstance(v, (str, int, float, bool, type(None))):
            key_parts.append(f"{k}:{v}")
        elif hasattr(v, '__str__'):
            key_parts.append(f"{k}:{str(v)}")
    
    # Create hash of key parts for shorter keys
    key_string = ':'.join(key_parts)
    key_hash = hashlib.md5(key_string.encode()).hexdigest()[:16]
    
    return f"{key_prefix}:{func_name}:{key_hash}"


def cache_result(ttl: int = 300, key_prefix: str = 'cache', key_func: Optional[Callable] = None):
    """
    Decorator to cache function results.
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache key (e.g., 'user', 'post')
        key_func: Optional custom function to generate cache key.
                  Should accept (func_name, args, kwargs) and return str.
    
    Usage:
        @cache_result(ttl=3600, key_prefix='user')
        def get_user_by_id(user_id: str):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get cache from app context
            try:
                cache = current_app.config.get('CACHE')
                if not cache or not cache.is_available():
                    # Redis unavailable, execute function directly
                    return func(*args, **kwargs)
            except RuntimeError:
                # Outside app context, execute function directly
                return func(*args, **kwargs)
            
            # Generate cache key
            if key_func:
                cache_key = key_func(func.__name__, args, kwargs)
            else:
                cache_key = _generate_cache_key(key_prefix, func.__name__, args, kwargs)
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_value
            
            # Cache miss, execute function
            logger.debug(f"Cache miss: {cache_key}")
            result = func(*args, **kwargs)
            
            # Store in cache (silently fail if Redis unavailable)
            if result is not None:
                try:
                    cache.set(cache_key, result, ttl)
                except Exception as e:
                    logger.warning(f"Failed to cache result for {cache_key}: {e}")
            
            return result
        
        return wrapper
    return decorator


def cache_key_simple(key_prefix: str, *arg_indices: int):
    """
    Helper to create simple cache key function using specific argument indices.
    
    Args:
        key_prefix: Prefix for cache key
        arg_indices: Indices of arguments to include in key (0-based)
    
    Usage:
        @cache_result(ttl=3600, key_func=cache_key_simple('user', 0))
        def get_user_by_id(user_id: str):
            ...
    """
    def key_func(func_name: str, args: tuple, kwargs: dict) -> str:
        key_parts = [key_prefix, func_name]
        for idx in arg_indices:
            if idx < len(args):
                key_parts.append(str(args[idx]))
        return ':'.join(key_parts)
    
    return key_func

