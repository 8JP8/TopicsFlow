import time
import logging
from typing import Any, Dict, Optional
from datetime import datetime
from flask import current_app

logger = logging.getLogger(__name__)

def save_session_backup(session_id: str, data: Dict[str, Any], ttl_seconds: int = 10 * 60) -> None:
    """
    Best-effort session backup to MongoDB/CosmosDB.
    Persists passkey challenges across deployments by using the database instead of local files.
    """
    if not session_id:
        return

    try:
        # Check if we have a database connection
        if not current_app or not hasattr(current_app, 'db'):
            logger.warning("Session backup skipped: No database connection available")
            return

        now = int(time.time())
        expires_at = now + ttl_seconds

        # Use DB upsert
        # We store 'expireAt' as a datetime object for potential future TTL index support
        # We store 'expires_at' as timestamp for consistent manual checking in load_session_backup
        current_app.db.session_backups.update_one(
            {'_id': str(session_id)},
            {'$set': {
                'data': data,
                'updated_at': now,
                'expires_at': expires_at,
                'expireAt': datetime.fromtimestamp(expires_at)
            }},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Failed to save session backup: {str(e)}")


def load_session_backup(session_id: str) -> Optional[Dict[str, Any]]:
    """Load a session backup if present and not expired."""
    if not session_id:
        return None

    try:
        if not current_app or not hasattr(current_app, 'db'):
            return None

        now = int(time.time())

        # Find document and verify it hasn't expired
        backup = current_app.db.session_backups.find_one({
            '_id': str(session_id),
            'expires_at': {'$gt': now}
        })

        if backup:
            return backup.get('data')

        return None
    except Exception as e:
        logger.error(f"Failed to load session backup: {str(e)}")
        return None


def delete_session_backup(session_id: str) -> None:
    """Delete a session backup."""
    if not session_id:
        return

    try:
        if current_app and hasattr(current_app, 'db'):
            current_app.db.session_backups.delete_one({'_id': str(session_id)})
    except Exception as e:
        logger.error(f"Failed to delete session backup: {str(e)}")
