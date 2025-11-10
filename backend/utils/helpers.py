import json
import secrets
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from bson import ObjectId


def json_serializer(obj: Any) -> str:
    """Custom JSON serializer for MongoDB ObjectId and datetime."""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, bytes):
        return base64.b64encode(obj).decode('utf-8')
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def safe_json_dumps(data: Any) -> str:
    """Safely serialize data to JSON, handling MongoDB types."""
    return json.dumps(data, default=json_serializer)


def parse_object_id(obj_id: str) -> Optional[ObjectId]:
    """Safely parse string to ObjectId."""
    try:
        return ObjectId(obj_id)
    except Exception:
        return None


def generate_token(length: int = 32) -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(length)


def generate_session_id() -> str:
    """Generate a secure session ID."""
    return secrets.token_hex(32)


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash a password with salt using SHA-256."""
    if salt is None:
        salt = secrets.token_hex(16)

    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return password_hash, salt


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    expected_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return secrets.compare_digest(expected_hash, password_hash)


def sanitize_input(text: str, max_length: int = 1000) -> str:
    """Sanitize user input text."""
    if not text:
        return ""

    # Basic sanitization
    text = text.strip()

    # Limit length
    if len(text) > max_length:
        text = text[:max_length]

    # Remove potentially dangerous characters
    dangerous_chars = ['<', '>', '&', '"', "'", '\\']
    for char in dangerous_chars:
        text = text.replace(char, '')

    return text


def format_datetime(dt: datetime, format_string: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Format datetime to string."""
    if dt is None:
        return ""
    return dt.strftime(format_string)


def parse_datetime(dt_string: str) -> Optional[datetime]:
    """Parse datetime string to datetime object."""
    try:
        return datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
    except Exception:
        return None


def time_ago(dt: datetime) -> str:
    """Get human-readable time ago string."""
    if dt is None:
        return "Never"

    now = datetime.utcnow()
    diff = now - dt

    seconds = diff.total_seconds()

    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif seconds < 2592000:  # 30 days
        days = int(seconds / 86400)
        return f"{days} day{'s' if days != 1 else ''} ago"
    else:
        return dt.strftime("%Y-%m-%d")


def paginate_list(items: List[Any], page: int, per_page: int) -> Dict[str, Any]:
    """Paginate a list of items."""
    if page < 1:
        page = 1

    if per_page < 1:
        per_page = 20

    total_items = len(items)
    total_pages = (total_items + per_page - 1) // per_page

    start_index = (page - 1) * per_page
    end_index = start_index + per_page

    paginated_items = items[start_index:end_index]

    return {
        'items': paginated_items,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total_items': total_items,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }


def build_query_params(request_args: dict) -> Dict[str, Any]:
    """Build query parameters dictionary from request args."""
    params = {}

    # Handle pagination
    page = request_args.get('page', '1')
    try:
        params['page'] = max(1, int(page))
    except ValueError:
        params['page'] = 1

    per_page = request_args.get('per_page', '20')
    try:
        params['per_page'] = min(100, max(1, int(per_page)))
    except ValueError:
        params['per_page'] = 20

    # Handle sorting
    sort_by = request_args.get('sort_by', 'created_at')
    sort_order = request_args.get('sort_order', 'desc')

    if sort_order.lower() in ['asc', 'desc']:
        params['sort_by'] = sort_by
        params['sort_order'] = sort_order.lower()

    # Handle filtering
    for key, value in request_args.items():
        if key not in ['page', 'per_page', 'sort_by', 'sort_order']:
            params[key] = value

    return params


def create_response(success: bool = True, data: Any = None, message: str = "",
                   errors: List[str] = None, status_code: int = 200) -> tuple:
    """Create a standardized API response."""
    response = {
        'success': success,
        'message': message,
        'timestamp': datetime.utcnow().isoformat()
    }

    if data is not None:
        response['data'] = data

    if errors:
        response['errors'] = errors

    return response, status_code


def error_response(message: str, status_code: int = 400, errors: List[str] = None) -> tuple:
    """Create a standardized error response."""
    return create_response(
        success=False,
        message=message,
        errors=errors or [message],
        status_code=status_code
    )


def success_response(data: Any = None, message: str = "", status_code: int = 200) -> tuple:
    """Create a standardized success response."""
    return create_response(
        success=True,
        data=data,
        message=message,
        status_code=status_code
    )


def validate_pagination(page: int, per_page: int, max_per_page: int = 100) -> tuple[int, int]:
    """Validate and sanitize pagination parameters."""
    page = max(1, page)
    per_page = min(max_per_page, max(1, per_page))
    return page, per_page


def calculate_offset(page: int, per_page: int) -> int:
    """Calculate offset for database queries."""
    return (page - 1) * per_page


def extract_hashtags(text: str) -> List[str]:
    """Extract hashtags from text."""
    import re
    hashtags = re.findall(r'#(\w+)', text)
    return list(set(hashtags))  # Remove duplicates


def extract_mentions(text: str) -> List[str]:
    """Extract @mentions from text."""
    import re
    mentions = re.findall(r'@(\w+)', text)
    return list(set(mentions))  # Remove duplicates


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate text to maximum length."""
    if len(text) <= max_length:
        return text

    return text[:max_length - len(suffix)] + suffix


def escape_html(text: str) -> str:
    """Escape HTML characters in text."""
    html_escape_table = {
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#x27;",
        ">": "&gt;",
        "<": "&lt;",
    }
    return "".join(html_escape_table.get(c, c) for c in text)


def is_valid_json(text: str) -> bool:
    """Check if text is valid JSON."""
    try:
        json.loads(text)
        return True
    except ValueError:
        return False


def merge_dicts(dict1: dict, dict2: dict) -> dict:
    """Merge two dictionaries recursively."""
    result = dict1.copy()

    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value

    return result


def get_client_ip(request) -> str:
    """Get client IP address from request."""
    # Check for forwarded IP
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()

    # Check for real IP
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip

    # Fall back to remote address
    return request.remote_addr or '0.0.0.0'


def generate_slug(text: str) -> str:
    """Generate URL-friendly slug from text."""
    import re

    # Convert to lowercase and replace spaces with hyphens
    slug = text.lower().strip()
    slug = re.sub(r'\s+', '-', slug)

    # Remove special characters except hyphens
    slug = re.sub(r'[^a-z0-9\-]', '', slug)

    # Remove multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug)

    # Remove leading/trailing hyphens
    slug = slug.strip('-')

    return slug


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    if size_bytes == 0:
        return "0 B"

    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)

    while size >= 1024.0 and i < len(size_names) - 1:
        size /= 1024.0
        i += 1

    return f"{size:.1f} {size_names[i]}"


def get_mime_type(filename: str) -> str:
    """Get MIME type from filename."""
    import mimetypes
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or 'application/octet-stream'


def is_image_file(filename: str) -> bool:
    """Check if file is an image based on filename."""
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
    return any(filename.lower().endswith(ext) for ext in image_extensions)


def generate_uuid() -> str:
    """Generate a UUID string."""
    import uuid
    return str(uuid.uuid4())


def deep_copy(obj: Any) -> Any:
    """Create a deep copy of an object."""
    import copy
    return copy.deepcopy(obj)