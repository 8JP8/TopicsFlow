"""
Cache decorator for automatically caching function results.
"""
import functools
import hashlib
import json
import logging
from typing import Any, Callable, Optional
from flask import current_app, request

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


def cache_result(ttl: int = 300, key_prefix: str = 'cache', key_func: Optional[Callable] = None, should_jsonify: bool = True):
    """
    Decorator to cache function results.
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache key (e.g., 'user', 'post')
        key_func: Optional custom function to generate cache key.
                  Should accept (func_name, args, kwargs) and return str.
        should_jsonify: If True (default), wraps dict/list results in jsonify() for Routes.
                       If False, returns raw data (use this for Model methods).
    
    Usage:
        @cache_result(ttl=3600, key_prefix='user', should_jsonify=False)
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
                print(f"[CACHE DEBUG] HIT {cache_key}")
                # If cached value is dict/list, re-wrap in jsonify for consistent Response object ONLY if requested
                if should_jsonify and isinstance(cached_value, (dict, list)):
                    from flask import jsonify
                    return jsonify(cached_value)
                return cached_value
            
            # Cache miss, execute function
            print(f"[CACHE DEBUG] MISS {cache_key}")
            result = func(*args, **kwargs)
            
            # Store in cache (silently fail if Redis unavailable)
            if result is not None:
                try:
                    cache_data = result
                    
                    # Handle Flask (response, status_code) tuples
                    if isinstance(result, tuple):
                        # Extract the response object (usually the first element)
                        response_obj = result[0]
                        # We only cache successful responses (usually 200)?
                        # Or we cache whatever. For now, let's just extract data.
                        # If result[1] (status) is error (e.g. 400, 500), MAYBE NOT cache?
                        # Let's inspect status code if possible.
                        status_code = result[1] if len(result) > 1 else 200
                        if status_code >= 400:
                            print(f"[CACHE DEBUG] SKIP caching error response {status_code} for {cache_key}")
                            return result

                        if hasattr(response_obj, 'get_json') and callable(response_obj.get_json):
                             try:
                                json_data = response_obj.get_json()
                                if json_data is not None:
                                    print(f"[CACHE DEBUG] Extracted JSON for {cache_key}")
                                    cache_data = json_data
                             except Exception as e:
                                print(f"[CACHE DEBUG] Failed to extract JSON from tuple response: {e}")
                    
                    # Handle single Response object
                    elif hasattr(result, 'get_json') and callable(result.get_json):
                        try:
                            json_data = result.get_json()
                            if json_data is not None:
                                cache_data = json_data
                        except Exception:
                            pass 
                    
                    print(f"[CACHE DEBUG] SET {cache_key}")
                    cache.set(cache_key, cache_data, ttl)
                except Exception as e:
                    logger.warning(f"Failed to cache result for {cache_key}: {e}")
                    print(f"[CACHE DEBUG] Failed to cache: {e}")
            
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


def user_cache_key(key_prefix: str):
    """
    Helper to create cache key that includes current user ID from request context.
    Requires @require_auth decorator to be applied *before* this (outer).
    
    Note: Since decorators applied top-down wrap inner functions, @cache_result should be 
    ABOVE @require_auth if we want to cache the result of the guarded function.
    BUT: If @cache_result is outer, it runs BEFORE @require_auth, so request.current_user 
    might NOT be set yet!
    
    CORRECTION: 
    If we use @cache_result -> @require_auth:
      cache_result wrapper runs.
      It calls generates key.
      It calls decorated function (which is the require_auth wrapper).
      require_auth wrapper runs, sets user, calls original function.
    
    So if cache_result wrapper runs first, request.current_user is NOT set.
    
    If we use @require_auth -> @cache_result:
      require_auth wrapper runs.
      It sets user.
      It calls decorated function (which is the cache_result wrapper).
      cache_result wrapper runs.
      It generates key (User IS set!).
      It checks cache.
    
    So correct order is:
    @require_auth()
    @cache_result(key_func=user_cache_key(...))
    def route(): ...
    """
    def key_func(func_name: str, args: tuple, kwargs: dict) -> str:
        user_id = 'anon'
        if hasattr(request, 'current_user') and request.current_user:
            user_id = str(request.current_user.get('id') or request.current_user.get('_id'))
        
        # Include query parameters in hash
        # Merge kwargs and request.args for the hash
        params_to_hash = kwargs.copy()
        if request.args:
            params_to_hash.update(request.args.to_dict())
            
        return _generate_cache_key(f"{key_prefix}:user:{user_id}", func_name, args, params_to_hash)
    
    return key_func


