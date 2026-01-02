import re
from typing import List
import bleach


def validate_username(username: str) -> bool:
    """Validate username format."""
    if not username or len(username) < 3 or len(username) > 20:
        return False

    # Allow letters, numbers, underscores, and hyphens
    # Cannot start or end with underscore or hyphen
    pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$'
    return bool(re.match(pattern, username))


def validate_email(email: str) -> bool:
    """Validate email format."""
    if not email:
        return False

    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """Validate phone number format (international)."""
    if not phone:
        return False

    # Remove all non-digit characters
    digits_only = re.sub(r'[^\d]', '', phone)

    # Phone number should be 10-15 digits
    return 10 <= len(digits_only) <= 15


def validate_password_strength(password: str) -> dict:
    """Validate password strength and return feedback."""
    if not password:
        return {'valid': False, 'errors': ['Password is required']}

    errors = []

    if len(password) < 8:
        errors.append('Password must be at least 8 characters long')

    if len(password) > 128:
        errors.append('Password must be less than 128 characters long')

    if not re.search(r'[a-z]', password):
        errors.append('Password must contain at least one lowercase letter')

    if not re.search(r'[A-Z]', password):
        errors.append('Password must contain at least one uppercase letter')

    if not re.search(r'\d', password):
        errors.append('Password must contain at least one number')

    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append('Password must contain at least one special character')

    # Check for common patterns
    common_patterns = [
        r'123456', r'password', r'qwerty', r'abc123', r'admin',
        r'letmein', r'welcome', r'monkey', r'dragon', r'football'
    ]

    for pattern in common_patterns:
        if pattern.lower() in password.lower():
            errors.append(f'Password contains common pattern: {pattern}')
            break

    return {'valid': len(errors) == 0, 'errors': errors}


def validate_totp_code(code: str) -> bool:
    """Validate TOTP code format."""
    if not code:
        return False

    # Ensure code is a string
    code = str(code).strip()

    # TOTP codes are 6 digits
    return bool(re.match(r'^\d{6}$', code))


def validate_backup_code(code: str) -> bool:
    """Validate backup code format."""
    if not code:
        return False

    # Ensure code is a string
    code = str(code).strip()

    # Backup codes are typically 8 digits
    return bool(re.match(r'^\d{8}$', code))


def validate_topic_title(title: str) -> dict:
    """Validate topic title."""
    if not title or not title.strip():
        return {'valid': False, 'errors': ['Title is required']}

    title = title.strip()

    if len(title) < 3:
        return {'valid': False, 'errors': ['Title must be at least 3 characters long']}

    if len(title) > 100:
        return {'valid': False, 'errors': ['Title must be less than 100 characters long']}

    # Check for valid characters (letters, numbers, spaces, and basic punctuation)
    if not re.match(r'^[a-zA-Z0-9\s\-_.,!?()[\]{}]+$', title):
        return {'valid': False, 'errors': ['Title contains invalid characters']}

    return {'valid': True, 'errors': []}


def validate_topic_description(description: str) -> dict:
    """Validate topic description."""
    if not description:
        return {'valid': True, 'errors': []}  # Description is optional

    description = description.strip()

    if len(description) > 500:
        return {'valid': False, 'errors': ['Description must be less than 500 characters long']}

    # Basic validation - prevent script tags and excessive special characters
    if '<script' in description.lower():
        return {'valid': False, 'errors': ['Description contains invalid content']}

    return {'valid': True, 'errors': []}


def validate_message_content(content: str) -> dict:
    """Validate message content."""
    if not content or not content.strip():
        return {'valid': False, 'errors': ['Message cannot be empty']}

    content = content.strip()

    if len(content) > 2000:
        return {'valid': False, 'errors': ['Message must be less than 2000 characters long']}

    # Check for excessive whitespace
    if re.search(r'\s{10,}', content):
        return {'valid': False, 'errors': ['Message contains excessive whitespace']}

    return {'valid': True, 'errors': []}


def validate_tags(tags: List[str]) -> dict:
    """Validate topic tags."""
    if not tags:
        return {'valid': True, 'errors': []}  # Tags are optional

    if len(tags) > 10:
        return {'valid': False, 'errors': ['Maximum 10 tags allowed']}

    errors = []
    valid_tags = []

    for tag in tags:
        tag = tag.strip().lower()
        if not tag:
            continue

        if len(tag) < 2:
            errors.append(f'Tag "{tag}" must be at least 2 characters long')
            continue

        if len(tag) > 20:
            errors.append(f'Tag "{tag}" must be less than 20 characters long')
            continue

        # Allow letters, numbers, and underscores
        if not re.match(r'^[a-z0-9_]+$', tag):
            errors.append(f'Tag "{tag}" contains invalid characters')
            continue

        if tag not in valid_tags:
            valid_tags.append(tag)

    if errors:
        return {'valid': False, 'errors': errors}

    return {'valid': True, 'errors': [], 'cleaned_tags': valid_tags}


def validate_report_reason(reason: str) -> bool:
    """Validate report reason."""
    if not reason or not reason.strip():
        return False

    reason = reason.strip()

    if len(reason) < 3:
        return False

    if len(reason) > 500:
        return False

    # Basic validation
    return not bool(re.search(r'<script', reason.lower()))


def validate_anonymous_name(name: str) -> dict:
    """Validate anonymous name for user-chosen option."""
    if not name or not name.strip():
        return {'valid': False, 'errors': ['Name is required']}

    name = name.strip()

    if len(name) < 3:
        return {'valid': False, 'errors': ['Name must be at least 3 characters long']}

    if len(name) > 20:
        return {'valid': False, 'errors': ['Name must be less than 20 characters long']}

    # Allow letters, numbers, and spaces
    if not re.match(r'^[a-zA-Z0-9\s]+$', name):
        return {'valid': False, 'errors': ['Name contains invalid characters']}

    return {'valid': True, 'errors': []}


def validate_security_question_answer(answer: str) -> bool:
    """Validate security question answer."""
    if not answer or not answer.strip():
        return False

    answer = answer.strip()

    if len(answer) < 2:
        return False

    if len(answer) > 100:
        return False

    return True


def sanitize_input(input_string: str) -> str:
    """Sanitize user input by removing potentially harmful content."""
    if not input_string:
        return ''

    # Define allowed tags and attributes (if any HTML is allowed)
    # For now, we strip everything except basic formatting if needed
    # But usually for inputs like username, we want plain text.
    # For posts/comments, we might want Markdown, which is rendered on client.
    # So stripping all tags is safer for API inputs unless rich text is expected.

    # bleach.clean by default allows a small set of tags.
    # We want to be stricter or allow specific things.
    # Since the original code removed all tags, let's stick to that default behavior
    # but use bleach to do it robustly.

    sanitized = bleach.clean(input_string, tags=[], attributes={}, strip=True)

    # Trim whitespace
    sanitized = sanitized.strip()

    return sanitized


def validate_pagination_params(limit: int, offset: int) -> dict:
    """Validate pagination parameters."""
    errors = []

    if limit is None or limit <= 0:
        limit = 20
    elif limit > 100:
        errors.append('Limit cannot exceed 100')
        limit = 100

    if offset is None or offset < 0:
        offset = 0
    elif offset > 10000:
        errors.append('Offset cannot exceed 10000')
        offset = 10000

    return {'valid': len(errors) == 0, 'errors': errors, 'limit': limit, 'offset': offset}


def validate_post_title(title: str) -> dict:
    """Validate post title."""
    if not title or not title.strip():
        return {'valid': False, 'errors': ['Post title is required']}

    title = title.strip()

    if len(title) < 3:
        return {'valid': False, 'errors': ['Post title must be at least 3 characters long']}

    if len(title) > 300:
        return {'valid': False, 'errors': ['Post title must be less than 300 characters long']}

    # Check for valid characters
    if not re.match(r'^[a-zA-Z0-9\s\-_.,!?()[\]{}:;]+$', title):
        return {'valid': False, 'errors': ['Post title contains invalid characters']}

    return {'valid': True, 'errors': []}


def validate_post_content(content: str) -> dict:
    """Validate post content."""
    if not content or not content.strip():
        return {'valid': False, 'errors': ['Post content is required']}

    content = content.strip()

    if len(content) > 10000:
        return {'valid': False, 'errors': ['Post content must be less than 10000 characters long']}

    # Basic validation - prevent script tags
    if '<script' in content.lower():
        return {'valid': False, 'errors': ['Post content contains invalid content']}

    return {'valid': True, 'errors': []}


def validate_comment_content(content: str) -> dict:
    """Validate comment content."""
    if not content or not content.strip():
        return {'valid': False, 'errors': ['Comment content is required']}

    content = content.strip()

    if len(content) > 5000:
        return {'valid': False, 'errors': ['Comment content must be less than 5000 characters long']}

    # Basic validation - prevent script tags
    if '<script' in content.lower():
        return {'valid': False, 'errors': ['Comment content contains invalid content']}

    return {'valid': True, 'errors': []}


def validate_chat_room_name(name: str) -> dict:
    """Validate chat room name."""
    if not name or not name.strip():
        return {'valid': False, 'errors': ['Chat room name is required']}

    name = name.strip()

    if len(name) < 2:
        return {'valid': False, 'errors': ['Chat room name must be at least 2 characters long']}

    if len(name) > 100:
        return {'valid': False, 'errors': ['Chat room name must be less than 100 characters long']}

    # Check for valid characters
    if not re.match(r'^[a-zA-Z0-9\s\-_]+$', name):
        return {'valid': False, 'errors': ['Chat room name contains invalid characters']}

    return {'valid': True, 'errors': []}


def validate_chat_room_description(description: str) -> dict:
    """Validate chat room description."""
    if not description:
        return {'valid': True, 'errors': []}  # Description is optional

    description = description.strip()

    if len(description) > 500:
        return {'valid': False, 'errors': ['Chat room description must be less than 500 characters long']}

    # Basic validation
    if '<script' in description.lower():
        return {'valid': False, 'errors': ['Chat room description contains invalid content']}

    return {'valid': True, 'errors': []}
