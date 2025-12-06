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
    Creates database notifications and emits socket events.
    
    Args:
        db: Database connection
        content_id: ID of the content (message, post, comment) containing the mention
        content_type: Type of content ('message', 'post', 'comment', 'chat_room_message')
        mentioned_user_ids: List of user ObjectIds mentioned
        sender_id: ID of the user who created the content
        context: Optional context dict with additional info (topic_id, post_id, chat_room_id, chat_room_name, post_title, etc.)
    """
    if not mentioned_user_ids:
        return
    
    logger.info(f"[MENTIONS] {content_type} {content_id} mentions users: {[str(uid) for uid in mentioned_user_ids]}")
    
    try:
        from models.notification import Notification
        from models.user import User
        from flask import current_app
        
        notification_model = Notification(db)
        user_model = User(db)
        
        # Get sender username
        sender = user_model.get_user_by_id(sender_id)
        sender_username = sender.get('username', 'Unknown') if sender else 'Unknown'
        
        # Get context name (chatroom name or post title)
        context_name = None
        context_id = None
        context_type = None
        
        if context:
            if 'chat_room_name' in context:
                context_name = context['chat_room_name']
                context_id = context.get('chat_room_id')
                context_type = 'chat_room'
            elif 'post_title' in context:
                context_name = context['post_title']
                context_id = context.get('post_id')
                context_type = 'post'
            elif 'topic_title' in context:
                context_name = context['topic_title']
                context_id = context.get('topic_id')
                context_type = 'topic'
        
        # Create notification for each mentioned user
        for mentioned_user_id in mentioned_user_ids:
            mentioned_user_id_str = str(mentioned_user_id)
            
            # Build notification message
            if context_name:
                message = f'{sender_username} mentioned you on "{context_name}"'
            else:
                message = f'{sender_username} mentioned you'
            
            # Create database notification
            notification_id = notification_model.create_notification(
                user_id=mentioned_user_id_str,
                notification_type='mention',
                title='You were mentioned',
                message=message,
                data={
                    'content_id': content_id,
                    'content_type': content_type,
                    'sender_id': sender_id,
                    'sender_username': sender_username,
                    'chat_room_id': context.get('chat_room_id') if context else None,
                    'chat_room_name': context.get('chat_room_name') if context else None,
                    'post_id': context.get('post_id') if context else None,
                    'post_title': context.get('post_title') if context else None,
                    'topic_id': context.get('topic_id') if context else None,
                },
                sender_id=sender_id,
                context_id=context_id,
                context_type=context_type
            )
            
            if notification_id:
                logger.info(f"Created mention notification {notification_id} for user {mentioned_user_id_str}")
                
                # Emit socket events
                try:
                    socketio = current_app.extensions.get('socketio')
                    if socketio:
                        user_room = f"user_{mentioned_user_id_str}"
                        
                        # Emit new_notification event
                        socketio.emit('new_notification', {
                            'id': notification_id,
                            'type': 'mention',
                            'title': 'You were mentioned',
                            'message': message,
                            'data': {
                                'content_id': content_id,
                                'content_type': content_type,
                                'sender_id': sender_id,
                                'sender_username': sender_username,
                                'chat_room_id': context.get('chat_room_id') if context else None,
                                'chat_room_name': context.get('chat_room_name') if context else None,
                                'post_id': context.get('post_id') if context else None,
                                'post_title': context.get('post_title') if context else None,
                            },
                            'sender_username': sender_username,
                            'context_id': context_id,
                            'context_type': context_type,
                            'context_name': context_name,
                            'timestamp': None  # Will be set by notification model
                        }, room=user_room)
                        
                        # Also emit user_mentioned event for backward compatibility
                        socketio.emit('user_mentioned', {
                            'type': 'mention',
                            'content_type': content_type,
                            'content_id': content_id,
                            'sender_id': sender_id,
                            'sender_username': sender_username,
                            'mentioned_user_id': mentioned_user_id_str,
                            'context': context or {},
                            'notification_id': notification_id
                        }, room=user_room)
                        
                        logger.info(f"Emitted mention notifications to room {user_room} for user {mentioned_user_id_str}")
                except Exception as e:
                    logger.warning(f"Failed to emit mention socket events: {str(e)}")
            else:
                logger.warning(f"Failed to create mention notification for user {mentioned_user_id_str}")
                
    except Exception as e:
        logger.error(f"Failed to notify mentioned users: {str(e)}", exc_info=True)


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








