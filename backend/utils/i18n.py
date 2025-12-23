"""
Internationalization helpers.

We intentionally normalize incoming language/locale strings to a stable short code
used by backend locale files (e.g. 'en', 'pt').
"""

from __future__ import annotations

from typing import Optional, Set


SUPPORTED_LANGUAGES: Set[str] = {"en", "pt"}
DEFAULT_LANGUAGE = "en"


def normalize_language(raw: Optional[str]) -> str:
    """
    Normalize a language/locale string to a supported short language code.

    Examples:
    - 'pt-PT' -> 'pt'
    - 'PT'    -> 'pt'
    - 'en-US' -> 'en'
    - None    -> 'en'
    """
    if not raw:
        return DEFAULT_LANGUAGE

    value = str(raw).strip()
    if not value:
        return DEFAULT_LANGUAGE

    # Handle common separators and casing: 'pt-PT', 'pt_PT', 'PT'
    value = value.replace("_", "-").lower()
    base = value.split("-", 1)[0].strip()

    if base in SUPPORTED_LANGUAGES:
        return base

    return DEFAULT_LANGUAGE


def normalize_language_optional(raw: Optional[str]) -> Optional[str]:
    """
    Normalize a language/locale string to a supported short language code.

    Unlike normalize_language(), this returns None when input is empty/missing,
    so callers can distinguish \"not provided\" vs \"provided but unsupported\".
    """
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None
    return normalize_language(value)


