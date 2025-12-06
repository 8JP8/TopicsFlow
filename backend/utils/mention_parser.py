import re
from typing import List, Set, Optional
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


def extract_mentions(content: str) -> List[str]:
    """
    Extract @username mentions from content.
    
    Args:
        content: The text content to parse
        
    Returns:
        List of unique usernames mentioned (without @ symbol)
    """
    if not content:
        return []
    
    # Pattern to match @username (alphanumeric and underscore, 3-20 chars)
    # Matches @username at word boundaries
    mention_pattern = r'@(\w{3,20})'
    mentions = re.findall(mention_pattern, content)
    
    # Return unique mentions
    return list(set(mentions))


def get_user_ids_from_mentions(db, usernames: List[str]) -> List[ObjectId]:
    """
    Convert usernames to user IDs.
    
    Args:
        db: Database connection
        usernames: List of usernames (without @ symbol)
        
    Returns:
        List of user ObjectIds
    """
    if not usernames:
        return []
    
    from models.user import User
    user_model = User(db)
    mentioned_user_ids = []
    
    for username in usernames:
        user = user_model.get_user_by_username(username)
        if user:
            mentioned_user_ids.append(ObjectId(user['_id']))
        else:
            logger.debug(f"Mentioned username '{username}' not found")
    
    return mentioned_user_ids


def extract_mentions_as_user_ids(db, content: str) -> List[ObjectId]:
    """
    Extract @username mentions from content and return list of user IDs.
    
    Args:
        db: Database connection
        content: The text content to parse
        
    Returns:
        List of user ObjectIds mentioned in the content
    """
    usernames = extract_mentions(content)
    return get_user_ids_from_mentions(db, usernames)


def notify_mentioned_users(db, content_id: str, content_type: str, 
                           mentioned_user_ids: List[ObjectId], 
                           sender_id: str, context: Optional[dict] = None) -> None:
    """
    Send notifications to mentioned users.
    
    Args:
        db: Database connection
        content_id: ID of the content (message, post, comment) containing the mention
        content_type: Type of content ('message', 'post', 'comment', 'chat_room_message')
        mentioned_user_ids: List of user ObjectIds mentioned
        sender_id: ID of the user who created the content
        context: Optional context dict with additional info (topic_id, post_id, etc.)
    """
    if not mentioned_user_ids:
        return
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[MENTIONS] {content_type} {content_id} mentions users: {[str(uid) for uid in mentioned_user_ids]}")
    
    # TODO: Integrate with notification system to send real-time notifications
    # For now, we can emit Socket.IO events for real-time notifications
    
    try:
        from flask import current_app
        socketio = current_app.extensions.get('socketio')
        if socketio:
            # Emit notification to each mentioned user
            for mentioned_user_id in mentioned_user_ids:
                user_room = f"user_{mentioned_user_id}"
                
                notification_data = {
                    'type': 'mention',
                    'content_type': content_type,
                    'content_id': content_id,
                    'sender_id': sender_id,
                    'mentioned_user_id': str(mentioned_user_id),
                    'context': context or {}
                }
                
                socketio.emit('user_mentioned', notification_data, room=user_room)
                logger.info(f"Emitted user_mentioned event to room {user_room} for user {mentioned_user_id}")
    except Exception as e:
        logger.warning(f"Failed to emit mention notification: {str(e)}")
    
    # TODO: Store notification in database for persistence
    # This would require a notifications collection/model


def process_mentions_in_content(db, content: str, content_id: str, 
                                content_type: str, sender_id: str,
                                context: Optional[dict] = None) -> List[ObjectId]:
    """
    Process mentions in content: extract, get user IDs, and send notifications.
    
    Args:
        db: Database connection
        content: The text content to parse
        content_id: ID of the content containing mentions
        content_type: Type of content ('message', 'post', 'comment', 'chat_room_message')
        sender_id: ID of the user who created the content
        context: Optional context dict with additional info
        
    Returns:
        List of user ObjectIds mentioned
    """
    mentioned_user_ids = extract_mentions_as_user_ids(db, content)
    
    if mentioned_user_ids:
        notify_mentioned_users(db, content_id, content_type, mentioned_user_ids, sender_id, context)
    
    return mentioned_user_ids








