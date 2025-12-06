from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.notification_settings import NotificationSettings
from utils.decorators import require_auth, log_requests
import logging

logger = logging.getLogger(__name__)
notification_settings_bp = Blueprint('notification_settings', __name__)


@notification_settings_bp.route('/posts/<post_id>/follow', methods=['POST'])
@require_auth()
@log_requests
def follow_post(post_id):
    """Follow a post to receive notifications for new comments."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        success = notification_settings.follow_post(user_id, post_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Post followed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to follow post']}), 400

    except Exception as e:
        logger.error(f"Follow post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to follow post: {str(e)}']}), 500


@notification_settings_bp.route('/posts/<post_id>/unfollow', methods=['POST'])
@require_auth()
@log_requests
def unfollow_post(post_id):
    """Unfollow a post."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        success = notification_settings.unfollow_post(user_id, post_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Post unfollowed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unfollow post']}), 400

    except Exception as e:
        logger.error(f"Unfollow post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unfollow post: {str(e)}']}), 500


@notification_settings_bp.route('/posts/<post_id>/status', methods=['GET'])
@require_auth()
@log_requests
def get_post_follow_status(post_id):
    """Get follow status for a post."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        is_following = notification_settings.is_following_post(user_id, post_id)

        return jsonify({
            'success': True,
            'data': {
                'following': is_following
            }
        }), 200

    except Exception as e:
        logger.error(f"Get post follow status error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get follow status: {str(e)}']}), 500


@notification_settings_bp.route('/chatrooms/<chat_room_id>/follow', methods=['POST'])
@require_auth()
@log_requests
def follow_chat_room(chat_room_id):
    """Follow a chat room to receive notifications for new messages."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        success = notification_settings.follow_chat_room(user_id, chat_room_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Chat room followed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to follow chat room']}), 400

    except Exception as e:
        logger.error(f"Follow chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to follow chat room: {str(e)}']}), 500


@notification_settings_bp.route('/chatrooms/<chat_room_id>/unfollow', methods=['POST'])
@require_auth()
@log_requests
def unfollow_chat_room(chat_room_id):
    """Unfollow a chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        success = notification_settings.unfollow_chat_room(user_id, chat_room_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Chat room unfollowed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unfollow chat room']}), 400

    except Exception as e:
        logger.error(f"Unfollow chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unfollow chat room: {str(e)}']}), 500


@notification_settings_bp.route('/topics/<topic_id>/mute', methods=['POST'])
@require_auth()
@log_requests
def mute_topic(topic_id):
    """Mute a topic (and all its publications and chatrooms) for a specified duration."""
    try:
        data = request.get_json() or {}
        minutes = data.get('minutes', -1)  # -1 = indefinite, 0 = unmute, >0 = duration in minutes

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        success = notification_settings.mute_topic(user_id, topic_id, minutes)

        if success:
            action = 'unmuted' if minutes == 0 else ('muted indefinitely' if minutes == -1 else f'muted for {minutes} minutes')
            return jsonify({
                'success': True,
                'message': f'Topic {action} successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mute topic']}), 400

    except Exception as e:
        logger.error(f"Mute topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute topic: {str(e)}']}), 500


@notification_settings_bp.route('/topics/<topic_id>/unmute', methods=['POST'])
@require_auth()
@log_requests
def unmute_topic(topic_id):
    """Unmute a topic."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        success = notification_settings.unmute_topic(user_id, topic_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Topic unmuted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unmute topic']}), 400

    except Exception as e:
        logger.error(f"Unmute topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unmute topic: {str(e)}']}), 500


@notification_settings_bp.route('/chatrooms/<chat_room_id>/status', methods=['GET'])
@require_auth()
@log_requests
def get_chat_room_follow_status(chat_room_id):
    """Get follow status for a chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        is_following = notification_settings.is_following_chat_room(user_id, chat_room_id)

        return jsonify({
            'success': True,
            'data': {
                'following': is_following
            }
        }), 200

    except Exception as e:
        logger.error(f"Get chat room follow status error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get follow status: {str(e)}']}), 500


@notification_settings_bp.route('/topics/<topic_id>/status', methods=['GET'])
@require_auth()
@log_requests
def get_topic_mute_status(topic_id):
    """Get mute status for a topic."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        is_muted = notification_settings.is_topic_muted(user_id, topic_id)

        return jsonify({
            'success': True,
            'data': {
                'muted': is_muted
            }
        }), 200

    except Exception as e:
        logger.error(f"Get topic mute status error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get mute status: {str(e)}']}), 500


@notification_settings_bp.route('/posts/followed', methods=['GET'])
@require_auth()
@log_requests
def get_followed_posts():
    """Get all posts that the current user is following."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_settings = NotificationSettings(current_app.db)
        followed_posts = notification_settings.get_followed_posts(user_id)

        # Get post details for each followed post
        from models.post import Post
        post_model = Post(current_app.db)
        posts_with_details = []
        
        for item in followed_posts:
            post_id = item['post_id']
            post = post_model.get_post_by_id(post_id)
            if post:
                posts_with_details.append({
                    'id': post_id,
                    'title': post.get('title', 'Untitled'),
                    'content': post.get('content', '')[:100] + '...' if len(post.get('content', '')) > 100 else post.get('content', ''),
                    'topic_id': str(post.get('topic_id', '')),
                    'author_username': post.get('author_username', 'Unknown'),
                    'created_at': post.get('created_at'),
                    'followed_at': item.get('created_at'),
                    'comment_count': post.get('comment_count', 0)
                })

        return jsonify({
            'success': True,
            'data': posts_with_details
        }), 200

    except Exception as e:
        logger.error(f"Get followed posts error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get followed posts: {str(e)}']}), 500

