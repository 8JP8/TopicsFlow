from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.user_content_settings import UserContentSettings
from utils.decorators import require_auth, log_requests
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
        success = settings_model.silence_topic(user_id, topic_id)
        
        if success:
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
            return jsonify({
                'success': True,
                'message': 'Post unhidden successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unhide post']}), 500
            
    except Exception as e:
        logger.error(f"Unhide post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unhide post: {str(e)}']}), 500


@content_settings_bp.route('/hidden-items', methods=['GET'])
@require_auth()
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

