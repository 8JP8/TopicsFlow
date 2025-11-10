import re
from typing import List, Dict, Optional


# Basic profanity word list - can be expanded or replaced with external service
PROFANITY_WORDS = [
    # English profanity
    'fuck', 'shit', 'cunt', 'bitch', 'asshole', 'bastard', 'damn', 'crap',
    'dick', 'pussy', 'cock', 'twat', 'wanker', 'slag', 'slut', 'whore',

    # Common variations
    'fucking', 'fucker', 'motherfucker', 'bullshit', 'jackass', 'dumbass',
    'asshat', 'dickhead', 'shithead', 'cock sucker', 'son of a bitch',

    # Portuguese profanity (basic list)
    'caralho', 'porra', 'puta', 'merda', 'cu', 'filho da puta', 'viado',
    'bicha', 'desgraça', 'porra', 'foda-se', 'puta que pariu',

    # Racial slurs and hate speech (will be filtered more aggressively)
    'nigger', 'nigga', 'kike', 'spic', 'chink', 'gook', 'wetback',
    'cracker', 'honkey', 'redskin', 'terrorist'
]

# URL patterns to block
URL_PATTERNS = [
    r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?',
    r'www\.(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?',
    r'[-\w.]+@[-\w.]+\.[a-zA-Z]{2,}',  # Email addresses
    r'\b(?:[-\w.]+\.)+(?:com|org|net|gov|edu|mil|int|info|biz|co|io|ai|app|dev|tech|store|online|site)\b'
]

# Phone number patterns to filter (optional)
PHONE_PATTERNS = [
    r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',  # US format
    r'\b\d{10,15}\b',  # International format
    r'\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b'  # International with country code
]


def contains_profanity(text: str) -> bool:
    """Check if text contains profanity."""
    if not text:
        return False

    # Convert to lowercase for comparison
    text_lower = text.lower()

    # Check for exact word matches to avoid false positives
    words = re.findall(r'\b\w+\b', text_lower)

    for word in words:
        if word in PROFANITY_WORDS:
            return True

    return False


def filter_profanity(text: str, replacement: str = '***') -> str:
    """Filter profanity from text by replacing with replacement characters."""
    if not text:
        return text

    # Split text into words and non-words (preserving punctuation)
    tokens = re.findall(r'\w+|\W+', text)

    for i, token in enumerate(tokens):
        if re.match(r'\w+', token):  # If it's a word
            if token.lower() in PROFANITY_WORDS:
                # Replace with same number of characters
                tokens[i] = replacement[:len(token)] if len(replacement) < len(token) else replacement

    return ''.join(tokens)


def contains_links(text: str) -> bool:
    """Check if text contains URLs or links."""
    if not text:
        return False

    for pattern in URL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True

    return False


def filter_links(text: str, replacement: str = '[Link removed]') -> str:
    """Filter links from text by replacing with replacement text."""
    if not text:
        return text

    filtered_text = text

    for pattern in URL_PATTERNS:
        filtered_text = re.sub(pattern, replacement, filtered_text, flags=re.IGNORECASE)

    return filtered_text


def contains_personal_info(text: str) -> bool:
    """Check if text contains potential personal information."""
    if not text:
        return False

    # Check for phone numbers
    for pattern in PHONE_PATTERNS:
        if re.search(pattern, text):
            return True

    # Check for email addresses
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    if re.search(email_pattern, text):
        return True

    # Check for potential Social Security Numbers or ID numbers
    ssn_pattern = r'\b\d{3}-?\d{2}-?\d{4}\b'
    if re.search(ssn_pattern, text):
        return True

    # Check for credit card patterns (basic)
    cc_pattern = r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
    if re.search(cc_pattern, text):
        return True

    return False


def filter_personal_info(text: str, replacement: str = '[Personal info removed]') -> str:
    """Filter personal information from text."""
    if not text:
        return text

    filtered_text = text

    # Filter phone numbers
    for pattern in PHONE_PATTERNS:
        filtered_text = re.sub(pattern, replacement, filtered_text)

    # Filter email addresses
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    filtered_text = re.sub(email_pattern, replacement, filtered_text)

    # Filter SSN patterns
    ssn_pattern = r'\b\d{3}-?\d{2}-?\d{4}\b'
    filtered_text = re.sub(ssn_pattern, replacement, filtered_text)

    # Filter credit card patterns
    cc_pattern = r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
    filtered_text = re.sub(cc_pattern, replacement, filtered_text)

    return filtered_text


def filter_content(text: str, filter_options: Optional[Dict] = None) -> str:
    """Apply comprehensive content filtering."""
    if not text:
        return text

    # Default filter options
    options = {
        'remove_links': True,
        'filter_profanity': True,
        'remove_personal_info': True,
        'profanity_replacement': '***',
        'link_replacement': '[Link removed]',
        'personal_info_replacement': '[Personal info removed]'
    }

    # Override with provided options
    if filter_options:
        options.update(filter_options)

    filtered_text = text

    # Apply filters
    if options['remove_links']:
        filtered_text = filter_links(filtered_text, options['link_replacement'])

    if options['filter_profanity']:
        filtered_text = filter_profanity(filtered_text, options['profanity_replacement'])

    if options['remove_personal_info']:
        filtered_text = filter_personal_info(filtered_text, options['personal_info_replacement'])

    return filtered_text


def analyze_content_safety(text: str) -> Dict:
    """Analyze content for various safety issues."""
    if not text:
        return {
            'is_safe': True,
            'issues': [],
            'severity': 'none'
        }

    issues = []
    severity = 'none'

    # Check for links
    if contains_links(text):
        issues.append('contains_links')
        severity = 'medium'

    # Check for profanity
    if contains_profanity(text):
        issues.append('contains_profanity')
        severity = 'high' if severity == 'none' else severity

    # Check for personal information
    if contains_personal_info(text):
        issues.append('contains_personal_info')
        severity = 'medium' if severity == 'none' else severity

    # Check for hate speech (basic pattern matching)
    hate_patterns = [
        r'\b(kill|murder|die|death)\s+\w+\s+(jews|blacks|whites|asians|muslims|christians|gays|lesbians)\b',
        r'\b(hate|destroy|eliminate)\s+\w+\s+(jews|blacks|whites|asians|muslims|christians|gays|lesbians)\b'
    ]

    for pattern in hate_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            issues.append('hate_speech')
            severity = 'critical'
            break

    # Check for threats
    threat_patterns = [
        r'\b(i\s+will|i\'ll)\s+(kill|hurt|harm|attack|find|dox)\s+\w+\b',
        r'\b(going\s+to|will)\s+(kill|hurt|harm|attack)\s+\w+\b',
        r'\b(doxx?|dox)\s+\w+\b'
    ]

    for pattern in threat_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            issues.append('threats')
            severity = 'critical'
            break

    return {
        'is_safe': len(issues) == 0,
        'issues': issues,
        'severity': severity,
        'filtered_content': filter_content(text) if issues else text
    }


def validate_username_safety(username: str) -> Dict:
    """Specific validation for usernames."""
    if not username:
        return {'valid': False, 'reason': 'Username is required'}

    issues = []

    # Check for profanity
    if contains_profanity(username):
        issues.append('contains_profanity')

    # Check for inappropriate patterns
    inappropriate_patterns = [
        r'admin', r'moderator', r'owner', r'bot', r'system', r'official',
        r'support', r'help', r'staff', r'team', r'null', r'undefined'
    ]

    username_lower = username.lower()
    for pattern in inappropriate_patterns:
        if pattern in username_lower:
            issues.append('restricted_term')
            break

    # Check for impersonation attempts
    impersonation_patterns = [
        r'.*[O0]wn?er.*', r'.*[Aa]dmin.*', r'.*[Mm]oderator.*', r'.*[Bb]ot.*'
    ]

    for pattern in impersonation_patterns:
        if re.match(pattern, username):
            issues.append('impersonation')
            break

    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'reason': ', '.join(issues) if issues else None
    }


def get_content_warnings(text: str) -> List[str]:
    """Get list of content warnings for text."""
    warnings = []

    analysis = analyze_content_safety(text)

    if 'contains_links' in analysis['issues']:
        warnings.append('This message contains links that have been removed.')

    if 'contains_profanity' in analysis['issues']:
        warnings.append('This message contains language that has been filtered.')

    if 'contains_personal_info' in analysis['issues']:
        warnings.append('This message contained personal information that has been removed.')

    if 'hate_speech' in analysis['issues']:
        warnings.append('This message contains potentially offensive content.')

    if 'threats' in analysis['issues']:
        warnings.append('This message contains threatening content.')

    return warnings