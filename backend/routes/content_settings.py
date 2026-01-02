from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.user_content_settings import UserContentSettings
from utils.decorators import require_auth, log_requests
from utils.cache_decorator import cache_result, user_cache_key
import logging

logger = logging.getLogger(__name__)
content_settings_bp = Blueprint('content_settings', __name__)


@content_settings_bp.route('/topics/<topic_id>/silence', methods=['POST'])
@require_auth()
@log_requests
def silence_topic(topic_id):
    """Silence a topic for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        
        # Get duration from request body (default to -1 for indefinite)
        data = request.get_json() or {}
        minutes = data.get('minutes', -1)
        
        success = settings_model.silence_topic(user_id, topic_id, minutes)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Topic silenced successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to silence topic']}), 500
            
    except Exception as e:
        logger.error(f"Silence topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to silence topic: {str(e)}']}), 500


@content_settings_bp.route('/topics/<topic_id>/unsilence', methods=['POST'])
@require_auth()
@log_requests
def unsilence_topic(topic_id):
    """Unsilence a topic for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.unsilence_topic(user_id, topic_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Topic unsilenced successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unsilence topic']}), 500
            
    except Exception as e:
        logger.error(f"Unsilence topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unsilence topic: {str(e)}']}), 500


@content_settings_bp.route('/topics/<topic_id>/hide', methods=['POST'])
@require_auth()
@log_requests
def hide_topic(topic_id):
    """Hide a topic for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.hide_topic(user_id, topic_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"topics:list:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Topic hidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to hide topic']}), 500
            
    except Exception as e:
        logger.error(f"Hide topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to hide topic: {str(e)}']}), 500


@content_settings_bp.route('/topics/<topic_id>/unhide', methods=['POST'])
@require_auth()
@log_requests
def unhide_topic(topic_id):
    """Unhide a topic for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.unhide_topic(user_id, topic_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"topics:list:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Topic unhidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unhide topic']}), 500
            
    except Exception as e:
        logger.error(f"Unhide topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unhide topic: {str(e)}']}), 500


@content_settings_bp.route('/posts/<post_id>/silence', methods=['POST'])
@require_auth()
@log_requests
def silence_post(post_id):
    """Silence a post for the current user."""
    try:
        from models.post import Post
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        # Get post to find topic_id
        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404
        
        topic_id = post.get('topic_id')
        if not topic_id:
            return jsonify({'success': False, 'errors': ['Post topic not found']}), 404
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.silence_post(user_id, post_id, str(topic_id))
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Post silenced successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to silence post']}), 500
            
    except Exception as e:
        logger.error(f"Silence post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to silence post: {str(e)}']}), 500


@content_settings_bp.route('/posts/<post_id>/unsilence', methods=['POST'])
@require_auth()
@log_requests
def unsilence_post(post_id):
    """Unsilence a post for the current user."""
    try:
        from models.post import Post
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        # Get post to find topic_id
        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404
        
        topic_id = post.get('topic_id')
        if not topic_id:
            return jsonify({'success': False, 'errors': ['Post topic not found']}), 404
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.unsilence_post(user_id, post_id, str(topic_id))
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Post unsilenced successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unsilence post']}), 500
            
    except Exception as e:
        logger.error(f"Unsilence post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unsilence post: {str(e)}']}), 500


@content_settings_bp.route('/posts/<post_id>/hide', methods=['POST'])
@require_auth()
@log_requests
def hide_post(post_id):
    """Hide a post for the current user."""
    try:
        from models.post import Post
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        # Get post to find topic_id
        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404
        
        topic_id = post.get('topic_id')
        if not topic_id:
            return jsonify({'success': False, 'errors': ['Post topic not found']}), 404
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.hide_post(user_id, post_id, str(topic_id))
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"posts:list:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Post hidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to hide post']}), 500
            
    except Exception as e:
        logger.error(f"Hide post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to hide post: {str(e)}']}), 500


@content_settings_bp.route('/posts/<post_id>/unhide', methods=['POST'])
@require_auth()
@log_requests
def unhide_post(post_id):
    """Unhide a post for the current user."""
    try:
        from models.post import Post
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        # Get post to find topic_id
        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404
        
        topic_id = post.get('topic_id')
        if not topic_id:
            return jsonify({'success': False, 'errors': ['Post topic not found']}), 404
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.unhide_post(user_id, post_id, str(topic_id))
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"posts:list:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Post unhidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unhide post']}), 500
            
    except Exception as e:
        logger.error(f"Unhide post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unhide post: {str(e)}']}), 500




@content_settings_bp.route('/chats/<chat_id>/hide', methods=['POST'])
@require_auth()
@log_requests
def hide_chat(chat_id):
    """Hide a specific chat/room for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        # We need the topic_id to hide a chat in the current model
        # However, for group chats topic_id is None.
        # Let's try to find if it's a group chat or topic chat
        from models.chat_room import ChatRoom
        chat_model = ChatRoom(current_app.db)
        chat = chat_model.get_chat_room_by_id(chat_id)
        if not chat:
            return jsonify({'success': False, 'errors': ['Chat not found']}), 404
        
        topic_id = chat.get('topic_id')
        if topic_id == 'None':
            topic_id = None
        else:
            topic_id = str(topic_id) if topic_id else None

        settings_model = UserContentSettings(current_app.db)
        success = settings_model.hide_chat(user_id, chat_id, topic_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"chat_room:list:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Chat hidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to hide chat']}), 500
            
    except Exception as e:
        logger.error(f"Hide chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to hide chat: {str(e)}']}), 500


@content_settings_bp.route('/chats/<chat_id>/unhide', methods=['POST'])
@require_auth()
@log_requests
def unhide_chat(chat_id):
    """Unhide a specific chat/room for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        from models.chat_room import ChatRoom
        chat_model = ChatRoom(current_app.db)
        chat = chat_model.get_chat_room_by_id(chat_id)
        if not chat:
            return jsonify({'success': False, 'errors': ['Chat not found']}), 404
        
        topic_id = chat.get('topic_id')
        if topic_id == 'None':
            topic_id = None
        else:
            topic_id = str(topic_id) if topic_id else None

        settings_model = UserContentSettings(current_app.db)
        success = settings_model.unhide_chat(user_id, chat_id, topic_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"chat_room:list:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Chat unhidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unhide chat']}), 500
            
    except Exception as e:
        logger.error(f"Unhide chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unhide chat: {str(e)}']}), 500


@content_settings_bp.route('/comments/<comment_id>/hide', methods=['POST'])
@require_auth()
@log_requests
def hide_comment(comment_id):
    """Hide a comment for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.hide_comment(user_id, comment_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Comment hidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to hide comment']}), 500
            
    except Exception as e:
        logger.error(f"Hide comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to hide comment: {str(e)}']}), 500


@content_settings_bp.route('/comments/<comment_id>/unhide', methods=['POST'])
@require_auth()
@log_requests
def unhide_comment(comment_id):
    """Unhide a comment for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.unhide_comment(user_id, comment_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Comment unhidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unhide comment']}), 500
            
    except Exception as e:
        logger.error(f"Unhide comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unhide comment: {str(e)}']}), 500


@content_settings_bp.route('/chat-messages/<message_id>/hide', methods=['POST'])
@require_auth()
@log_requests
def hide_chat_message(message_id):
    """Hide a chat message for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.hide_chat_message(user_id, message_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Message hidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to hide message']}), 500
            
    except Exception as e:
        logger.error(f"Hide message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to hide message: {str(e)}']}), 500



@content_settings_bp.route('/chat-messages/<message_id>/unhide', methods=['POST'])
@require_auth()
@log_requests
def unhide_chat_message(message_id):
    """Unhide a chat message for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        success = settings_model.unhide_chat_message(user_id, message_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Message unhidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unhide message']}), 500
            
    except Exception as e:
        logger.error(f"Unhide message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unhide message: {str(e)}']}), 500


@content_settings_bp.route('/private-messages/<message_id>/unhide', methods=['POST'])
@require_auth()
@log_requests
def unhide_private_message(message_id):
    """Unhide (restore) a private message for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)
        success = pm_model.restore_message_for_me(message_id, user_id)
        
        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"settings:content:user:{user_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Message unhidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unhide message']}), 500
            
    except Exception as e:
        logger.error(f"Unhide private message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unhide message: {str(e)}']}), 500


@content_settings_bp.route('/hidden-items', methods=['GET'])
@require_auth()
@cache_result(ttl=300, key_prefix='settings:content', key_func=user_cache_key('settings:content'))
@log_requests
def get_hidden_items():
    """Get all hidden items for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        hidden_items = settings_model.get_hidden_items(user_id)
        
        return jsonify({
            'success': True,
            'data': hidden_items
        }), 200
            
    except Exception as e:
        logger.error(f"Get hidden items error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get hidden items: {str(e)}']}), 500


@content_settings_bp.route('/silenced-items', methods=['GET'])
@require_auth()
@cache_result(ttl=300, key_prefix='settings:content', key_func=user_cache_key('settings:content'))
@log_requests
def get_silenced_items():
    """Get all silenced items for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        
        settings_model = UserContentSettings(current_app.db)
        silenced_items = settings_model.get_silenced_items(user_id)
        
        return jsonify({
            'success': True,
            'data': silenced_items
        }), 200
            
    except Exception as e:
        logger.error(f"Get silenced items error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get silenced items: {str(e)}']}), 500

