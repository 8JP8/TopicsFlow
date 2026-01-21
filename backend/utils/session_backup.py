import time
import logging
import json
from typing import Any, Dict, Optional
from datetime import datetime
from flask import current_app

logger = logging.getLogger(__name__)

def save_session_backup(session_id: str, data: Dict[str, Any], ttl_seconds: int = 10 * 60) -> None:
    """
    Best-effort session backup to Redis (Cache) and MongoDB (Persistence).
    Persists passkey challenges across deployments.
    """
    if not session_id:
        return

    # 1. Try Cache (Redis)
    try:
        redis_client = current_app.config.get('REDIS_CLIENT')
        if redis_client:
            redis_key = f"backup_session:{session_id}"
            # Store as JSON string in Redis
            redis_client.setex(redis_key, ttl_seconds, json.dumps(data))
    except Exception as e:
        logger.warning(f"Failed to save session backup to Redis: {str(e)}")

    # 2. Always persist to DB as safe fallback
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
        logger.error(f"Failed to save session backup to DB: {str(e)}")


def load_session_backup(session_id: str) -> Optional[Dict[str, Any]]:
    """Load a session backup if present and not expired."""
    if not session_id:
        return None

    # 1. Try Cache (Redis) first
    try:
        redis_client = current_app.config.get('REDIS_CLIENT')
        if redis_client:
            redis_key = f"backup_session:{session_id}"
            cached_data = redis_client.get(redis_key)
            if cached_data:
                return json.loads(cached_data)
    except Exception as e:
        logger.warning(f"Failed to load session backup from Redis: {str(e)}")

    # 2. Fallback to DB
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
        logger.error(f"Failed to load session backup from DB: {str(e)}")
        return None


def delete_session_backup(session_id: str) -> None:
    """Delete a session backup."""
    if not session_id:
        return

    # 1. Delete from Cache
    try:
        redis_client = current_app.config.get('REDIS_CLIENT')
        if redis_client:
            redis_key = f"backup_session:{session_id}"
            redis_client.delete(redis_key)
    except Exception:
        pass

    # 2. Delete from DB
    try:
        if current_app and hasattr(current_app, 'db'):
            current_app.db.session_backups.delete_one({'_id': str(session_id)})
    except Exception as e:
        logger.error(f"Failed to delete session backup: {str(e)}")
