from functools import wraps
from flask import jsonify, request, current_app
from datetime import datetime, timedelta
import time
from collections import defaultdict
import logging
import os

logger = logging.getLogger(__name__)

# Simple in-memory rate limiting store (fallback)
rate_limit_store = defaultdict(list)


def rate_limit(limit: str):
    """Rate limiting decorator.

    Supports Redis for distributed rate limiting if REDIS_URL is configured.
    Falls back to in-memory storage.

    Args:
        limit: Rate limit string in format "count/period" where period is minute, hour, etc.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Parse limit string
            try:
                count, period = limit.split('/')
                count = int(count)
                period = period.lower()
            except ValueError:
                logger.error(f"Invalid rate limit format: {limit}")
                return f(*args, **kwargs)  # Skip rate limiting if format is invalid

            # Get client identifier
            client_id = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'unknown'))
            # Use request.endpoint if available, otherwise fallback to function name
            endpoint = request.endpoint or f.__name__

            # Key prefix for rate limiting
            key = f"ratelimit:{client_id}:{endpoint}"

            # Calculate time window in seconds
            if period == 'minute':
                window = 60
            elif period == 'hour':
                window = 3600
            elif period == 'day':
                window = 86400
            else:
                window = 60

            # Check if Redis is available (Azure only)
            redis_client = None
            try:
                is_azure = bool(current_app.config.get('IS_AZURE'))
                redis_url = current_app.config.get('REDIS_URL')
                if is_azure and redis_url:
                    # Try to get redis client from app config/extensions if initialized
                    if hasattr(current_app, 'extensions') and 'redis' in current_app.extensions:
                        redis_client = current_app.extensions['redis']
                    else:
                        # Lazy import to avoid circular dependencies
                        import redis
                        redis_client = redis.from_url(redis_url)
            except Exception as e:
                logger.warning(f"Redis not available for rate limiting: {e}")
                redis_client = None

            if redis_client:
                # Use Redis for rate limiting (Distributed)
                try:
                    # Uses a sliding window log or simple counter with expiration
                    # Simple counter implementation:
                    current = redis_client.get(key)

                    if current and int(current) >= count:
                         return jsonify({
                            'success': False,
                            'errors': [f'Rate limit exceeded. Maximum {count} requests per {period}.']
                        }), 429

                    # Increment counter
                    pipe = redis_client.pipeline()
                    pipe.incr(key)
                    if not current:
                        # Set expiration on first request
                        pipe.expire(key, window)
                    pipe.execute()

                except Exception as e:
                    logger.warning(f"Redis rate limit error (using in-memory fallback): {e}")
                    # Fallback to in-memory if Redis fails
                    memory_response = _check_in_memory_limit(key, count, window)
                    if memory_response:
                        return memory_response
            else:
                # Fallback to in-memory
                memory_response = _check_in_memory_limit(key, count, window)
                if memory_response:
                    return memory_response

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def _check_in_memory_limit(key, count, window):
    """Check rate limit using in-memory store."""
    now = int(time.time())
    window_start = now - window

    # Clean old entries
    rate_limit_store[key] = [timestamp for timestamp in rate_limit_store[key] if timestamp > window_start]

    # Check if limit exceeded
    if len(rate_limit_store[key]) >= count:
        return jsonify({
            'success': False,
            'errors': [f'Rate limit exceeded.']
        }), 429

    # Add current request
    rate_limit_store[key].append(now)
    return None # Indicates not blocked


def require_json(f):
    """Decorator to require JSON content type."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            return jsonify({
                'success': False,
                'errors': ['Content-Type must be application/json']
            }), 400
        return f(*args, **kwargs)
    return decorated_function


def require_auth():
    """Decorator to require authentication."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import current_app
            from services.auth_service import AuthService

            auth_service = AuthService(current_app.db)
            if not auth_service.is_authenticated():
                return jsonify({
                    'success': False,
                    'errors': ['Authentication required']
                }), 401

            # Add current user to request context
            current_user_result = auth_service.get_current_user()
            if current_user_result['success']:
                request.current_user = current_user_result['user']

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_role(required_role: str):
    """Decorator to require specific user role/permission."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import current_app
            from services.auth_service import AuthService

            auth_service = AuthService(current_app.db)
            if not auth_service.is_authenticated():
                return jsonify({
                    'success': False,
                    'errors': ['Authentication required']
                }), 401

            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return jsonify({
                    'success': False,
                    'errors': ['Invalid session']
                }), 401

            # For now, all authenticated users have basic permissions
            # This can be extended with role-based access control
            if required_role == 'admin':
                # Check if user is admin (implement admin logic)
                return jsonify({
                    'success': False,
                    'errors': ['Admin access required']
                }), 403

            request.current_user = current_user_result['user']
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def validate_json(schema: dict):
    """Decorator to validate JSON request body against a schema."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({
                    'success': False,
                    'errors': ['Content-Type must be application/json']
                }), 400

            data = request.get_json()
            errors = []

            for field, rules in schema.items():
                value = data.get(field)

                # Required field validation
                if rules.get('required', False) and value is None:
                    errors.append(f'{field} is required')
                    continue

                if value is None:
                    continue  # Skip other validations if field is optional and not provided

                # Type validation
                field_type = rules.get('type')
                if field_type == 'string' and not isinstance(value, str):
                    errors.append(f'{field} must be a string')
                elif field_type == 'integer' and not isinstance(value, int):
                    errors.append(f'{field} must be an integer')
                elif field_type == 'boolean' and not isinstance(value, bool):
                    errors.append(f'{field} must be a boolean')
                elif field_type == 'list' and not isinstance(value, list):
                    errors.append(f'{field} must be a list')

                # Length validation for strings
                if isinstance(value, str):
                    min_length = rules.get('min_length')
                    max_length = rules.get('max_length')

                    if min_length is not None and len(value) < min_length:
                        errors.append(f'{field} must be at least {min_length} characters long')

                    if max_length is not None and len(value) > max_length:
                        errors.append(f'{field} must be at most {max_length} characters long')

                # List validation
                if isinstance(value, list):
                    min_items = rules.get('min_items')
                    max_items = rules.get('max_items')

                    if min_items is not None and len(value) < min_items:
                        errors.append(f'{field} must have at least {min_items} items')

                    if max_items is not None and len(value) > max_items:
                        errors.append(f'{field} must have at most {max_items} items')

            if errors:
                return jsonify({
                    'success': False,
                    'errors': errors
                }), 400

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def cors_headers(f):
    """Decorator to add CORS headers."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = f(*args, **kwargs)

        # Handle tuple responses (status_code, headers)
        if isinstance(response, tuple):
            if len(response) == 2:
                data, status_code = response
                headers = {}
            else:
                data, status_code, headers = response
        else:
            data = response
            status_code = 200
            headers = {}

        # Add CORS headers
        headers.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        })

        return data, status_code, headers
    return decorated_function


def log_requests(f):
    """Decorator to log requests."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()

        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'unknown'))
        method = request.method
        endpoint = request.endpoint
        user_agent = request.headers.get('User-Agent', 'unknown')

        logger.info(f"Request: {method} {endpoint} from {client_ip} - {user_agent}")

        try:
            response = f(*args, **kwargs)

            # Calculate response time
            response_time = time.time() - start_time

            # Extract status code safely - handle both tuple and Response objects
            try:
                if isinstance(response, tuple):
                    status_code = response[1] if len(response) > 1 else 200
                elif hasattr(response, 'status_code'):
                    status_code = response.status_code
                else:
                    status_code = 200
                logger.info(f"Response: {status_code} in {response_time:.3f}s for {method} {endpoint}")
            except Exception as log_error:
                # Don't fail the request if logging fails
                logger.warning(f"Could not extract response status for logging: {str(log_error)}")

            return response

        except Exception as e:
            response_time = time.time() - start_time
            logger.error(f"Error in {method} {endpoint} after {response_time:.3f}s: {str(e)}", exc_info=True)
            # Re-raise to let Flask handle the error properly
            raise

    return decorated_function


def cache_response(timeout: int = 300):
    """Simple response caching decorator (use Redis in production)."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Create cache key
            cache_key = f"{request.method}:{request.endpoint}:{str(args)}:{str(kwargs)}"

            # Check cache (simplified implementation)
            # In production, use Redis or similar
            cache_store = getattr(cache_response, 'cache_store', {})

            # Clean expired entries
            now = time.time()
            expired_keys = [key for key, (data, timestamp) in cache_store.items()
                          if now - timestamp > timeout]
            for key in expired_keys:
                del cache_store[key]

            # Check if we have cached response
            if cache_key in cache_store:
                cached_data, cached_time = cache_store[cache_key]
                if now - cached_time < timeout:
                    return cached_data

            # Generate response
            response = f(*args, **kwargs)

            # Cache the response
            cache_response.cache_store = cache_store
            cache_store[cache_key] = (response, now)

            return response
        return decorated_function
    return decorator


# Initialize cache store
cache_response.cache_store = {}


def cleanup_rate_limit_store():
    """Clean up old entries from rate limit store."""
    global rate_limit_store

    now = int(time.time())
    cutoff_time = now - 86400  # Remove entries older than 24 hours

    for key in list(rate_limit_store.keys()):
        rate_limit_store[key] = [timestamp for timestamp in rate_limit_store[key] if timestamp > cutoff_time]
        if not rate_limit_store[key]:
            del rate_limit_store[key]
