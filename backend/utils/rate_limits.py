"""
Rate limiting configuration for the TopicsFlow application.

This file defines rate limits for different parts of the application.
Format: 'requests/timeframe' where timeframe can be:
- second, minute, hour, day
Examples: '5/minute', '100/hour', '1000/day'
"""

# Authentication endpoints - strict limits to prevent brute force
AUTH_LIMITS = {
    'login': '5/minute',
    'register': '3/hour',
    'logout': '10/minute',
    'totp_verify': '10/minute',
    'backup_code': '3/hour',
    'password_change': '5/hour',
    'recovery': '3/hour',
}

# Topic endpoints
TOPIC_LIMITS = {
    'create': '10/hour',
    'update': '20/hour',
    'delete': '10/hour',
    'list': '100/minute',
    'get': '200/minute',
    'join': '30/hour',
    'leave': '30/hour',
}

# Message endpoints
MESSAGE_LIMITS = {
    'send_topic': '60/minute',  # 1 message per second
    'send_private': '30/minute',
    'get_messages': '100/minute',
    'delete': '20/hour',
    'report': '10/hour',
    'search': '30/minute',
}

# User endpoints
USER_LIMITS = {
    'profile_update': '10/hour',
    'search': '60/minute',
    'get_profile': '100/minute',
}

# Friend request endpoints
FRIEND_LIMITS = {
    'send_request': '20/hour',
    'accept': '50/hour',
    'reject': '50/hour',
    'cancel': '50/hour',
    'list': '100/minute',
    'unfriend': '20/hour',
}

# Report endpoints
REPORT_LIMITS = {
    'create': '10/hour',
    'list': '100/minute',
    'review': '50/hour',
}

# Default rate limit for endpoints without specific limits
DEFAULT_LIMIT = '100/minute'

# Global rate limit per IP address (regardless of authentication)
GLOBAL_IP_LIMIT = '1000/hour'

# Authenticated user global limit (across all endpoints)
GLOBAL_USER_LIMIT = '2000/hour'


def get_limit(category, action=None):
    """
    Get rate limit for a specific category and action.

    Args:
        category: Category name (auth, topic, message, user, friend, report)
        action: Specific action within category (optional)

    Returns:
        Rate limit string (e.g., '5/minute')
    """
    limits_map = {
        'auth': AUTH_LIMITS,
        'topic': TOPIC_LIMITS,
        'message': MESSAGE_LIMITS,
        'user': USER_LIMITS,
        'friend': FRIEND_LIMITS,
        'report': REPORT_LIMITS,
    }

    category_limits = limits_map.get(category, {})

    if action:
        return category_limits.get(action, DEFAULT_LIMIT)

    return DEFAULT_LIMIT


# Rate limit exemptions (user IDs or IP addresses that bypass rate limiting)
# Useful for admins, monitoring services, etc.
EXEMPT_USER_IDS = [
    # Add admin user IDs here if needed
]

EXEMPT_IP_ADDRESSES = [
    '127.0.0.1',  # Localhost
    # Add trusted IP addresses here
]


# Rate limit storage backend configuration
RATE_LIMIT_STORAGE = {
    'type': 'memory',  # Options: 'memory', 'redis'
    # Redis configuration (if using Redis backend)
    'redis': {
        'host': 'localhost',
        'port': 6379,
        'db': 1,
        'password': None,
    }
}


# Rate limit exceeded response
RATE_LIMIT_EXCEEDED_MESSAGE = 'Rate limit exceeded. Please try again later.'
RATE_LIMIT_EXCEEDED_STATUS_CODE = 429


# Enable/disable rate limiting globally
RATE_LIMITING_ENABLED = True


# Rate limit headers (include rate limit info in response headers)
INCLUDE_RATE_LIMIT_HEADERS = True






