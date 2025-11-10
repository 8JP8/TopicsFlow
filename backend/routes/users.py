from flask import Blueprint, request, jsonify
from services.auth_service import AuthService
from models.user import User
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from models.private_message import PrivateMessage
from utils.decorators import require_auth, log_requests
import logging

logger = logging.getLogger(__name__)
users_bp = Blueprint('users', __name__)


@users_bp.route('/profile', methods=['GET'])
@require_auth()
@log_requests
def get_user_profile():
    """Get current user's profile."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()

        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['User not found']}), 404

        return jsonify({
            'success': True,
            'data': current_user_result['user']
        }), 200

    except Exception as e:
        logger.error(f"Get user profile error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user profile']}), 500


@users_bp.route('/<user_id>', methods=['GET'])
@log_requests
def get_user_by_id(user_id):
    """Get user profile by ID (public information only)."""
    try:
        from flask import current_app
        user_model = User(current_app.db)

        user = user_model.get_user_by_id(user_id)
        if not user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404

        # Return only public information
        public_user = {
            'id': str(user['_id']),
            'username': user['username'],
            'created_at': user.get('created_at'),
            'preferences': user.get('preferences', {})
        }

        return jsonify({
            'success': True,
            'data': public_user
        }), 200

    except Exception as e:
        logger.error(f"Get user by ID error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user']}), 500


@users_bp.route('/username/<username>', methods=['GET'])
@log_requests
def get_user_by_username(username):
    """Get user profile by username (public information only)."""
    try:
        from flask import current_app
        user_model = User(current_app.db)

        user = user_model.get_user_by_username(username)
        if not user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404

        # Return only public information
        public_user = {
            'id': str(user['_id']),
            'username': user['username'],
            'created_at': user.get('created_at'),
            'preferences': user.get('preferences', {})
        }

        return jsonify({
            'success': True,
            'data': public_user
        }), 200

    except Exception as e:
        logger.error(f"Get user by username error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user']}), 500


@users_bp.route('/topics', methods=['GET'])
@require_auth()
@log_requests
def get_user_topics():
    """Get topics that the current user is a member of."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        topics = topic_model.get_user_topics(user_id)

        return jsonify({
            'success': True,
            'data': topics
        }), 200

    except Exception as e:
        logger.error(f"Get user topics error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user topics']}), 500


@users_bp.route('/anonymous-identities', methods=['GET'])
@require_auth()
@log_requests
def get_anonymous_identities():
    """Get all anonymous identities for the current user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        anon_model = AnonymousIdentity(current_app.db)
        identities = anon_model.get_user_identities(user_id)

        return jsonify({
            'success': True,
            'data': identities
        }), 200

    except Exception as e:
        logger.error(f"Get anonymous identities error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get anonymous identities']}), 500


@users_bp.route('/anonymous-identities/<topic_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_anonymous_identity(topic_id):
    """Delete anonymous identity for a specific topic."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        anon_model = AnonymousIdentity(current_app.db)
        success = anon_model.delete_identity(user_id, topic_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Anonymous identity deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to delete anonymous identity']}), 400

    except Exception as e:
        logger.error(f"Delete anonymous identity error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to delete anonymous identity']}), 500


@users_bp.route('/private-messages/conversations', methods=['GET'])
@require_auth()
@log_requests
def get_private_conversations():
    """Get private message conversations for current user."""
    try:
        limit = int(request.args.get('limit', 20))

        if limit < 1 or limit > 50:
            limit = 20

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        pm_model = PrivateMessage(current_app.db)
        conversations = pm_model.get_conversations(user_id, limit)

        return jsonify({
            'success': True,
            'data': conversations
        }), 200

    except Exception as e:
        logger.error(f"Get private conversations error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get private conversations']}), 500


@users_bp.route('/private-messages/<other_user_id>', methods=['GET'])
@require_auth()
@log_requests
def get_private_conversation(other_user_id):
    """Get private message conversation with a specific user."""
    try:
        limit = int(request.args.get('limit', 50))
        before_message_id = request.args.get('before_message_id')

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        pm_model = PrivateMessage(current_app.db)
        messages = pm_model.get_conversation(
            user_id=user_id,
            other_user_id=other_user_id,
            limit=limit,
            before_message_id=before_message_id
        )

        return jsonify({
            'success': True,
            'data': messages
        }), 200

    except Exception as e:
        logger.error(f"Get private conversation error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get private conversation']}), 500


@users_bp.route('/private-messages/unread-count', methods=['GET'])
@require_auth()
@log_requests
def get_unread_message_count():
    """Get unread private message count for current user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        pm_model = PrivateMessage(current_app.db)
        unread_count = pm_model.get_unread_count(user_id)

        return jsonify({
            'success': True,
            'data': {
                'unread_count': unread_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get unread message count error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get unread message count']}), 500


@users_bp.route('/private-messages/<other_user_id>/read', methods=['POST'])
@require_auth()
@log_requests
def mark_conversation_read(other_user_id):
    """Mark all messages from a user as read."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        pm_model = PrivateMessage(current_app.db)
        marked_count = pm_model.mark_conversation_as_read(user_id, other_user_id)

        return jsonify({
            'success': True,
            'message': f'Marked {marked_count} messages as read',
            'data': {
                'marked_count': marked_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Mark conversation read error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to mark conversation as read']}), 500


@users_bp.route('/search', methods=['GET'])
@require_auth()
@log_requests
def search_users():
    """Search users by username."""
    try:
        query = request.args.get('q', '').strip()

        if not query:
            return jsonify({'success': False, 'errors': ['Search query is required']}), 400

        if len(query) < 2:
            return jsonify({'success': False, 'errors': ['Search query must be at least 2 characters']}), 400

        limit = int(request.args.get('limit', 20))
        if limit < 1 or limit > 50:
            limit = 20

        from flask import current_app
        user_model = User(current_app.db)

        # Search users
        users = list(current_app.db.users.find({
            'username': {'$regex': query, '$options': 'i'},
            'is_banned': False
        }).limit(limit))

        # Return public information only
        public_users = []
        for user in users:
            public_users.append({
                'id': str(user['_id']),
                'username': user['username'],
                'created_at': user.get('created_at')
            })

        return jsonify({
            'success': True,
            'data': {
                'users': public_users,
                'query': query,
                'count': len(public_users)
            }
        }), 200

    except Exception as e:
        logger.error(f"Search users error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to search users']}), 500


@users_bp.route('/stats', methods=['GET'])
@require_auth()
@log_requests
def get_user_stats():
    """Get statistics for the current user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        # Get various stats
        topic_model = Topic(current_app.db)
        anon_model = AnonymousIdentity(current_app.db)
        pm_model = PrivateMessage(current_app.db)

        # Topics count
        user_topics = topic_model.get_user_topics(user_id)

        # Anonymous identities stats
        anon_stats = anon_model.get_anonymous_stats(user_id)

        # Private messages stats
        pm_stats = pm_model.get_message_stats(user_id)

        # Combine stats
        stats = {
            'topics_count': len(user_topics),
            'anonymous_identities': anon_stats,
            'private_messages': pm_stats
        }

        return jsonify({
            'success': True,
            'data': stats
        }), 200

    except Exception as e:
        logger.error(f"Get user stats error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user stats']}), 500


@users_bp.route('/online', methods=['GET'])
@log_requests
def get_online_users():
    """Get list of currently online users."""
    try:
        from flask import current_app
        from socketio_handlers import connected_users

        # Get online users (public information only)
        online_users = []
        for user_id, user_data in connected_users.items():
            if user_data.get('is_online', False):
                online_users.append({
                    'user_id': user_id,
                    'username': user_data['username'],
                    'connected_at': user_data['connected_at'].isoformat()
                })

        return jsonify({
            'success': True,
            'data': {
                'users': online_users,
                'count': len(online_users)
            }
        }), 200

    except Exception as e:
        logger.error(f"Get online users error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get online users']}), 500


@users_bp.route('/check-username', methods=['POST'])
def check_username_availability():
    """Check if a username is available (for registration)."""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()

        if not username:
            return jsonify({'success': False, 'errors': ['Username is required']}), 400

        if len(username) < 3 or len(username) > 20:
            return jsonify({'success': False, 'errors': ['Username must be between 3 and 20 characters']}), 400

        from flask import current_app
        user_model = User(current_app.db)

        # Check if username exists
        existing_user = user_model.get_user_by_username(username)
        is_available = existing_user is None

        # Also check for profanity
        from utils.content_filter import contains_profanity
        has_profanity = contains_profanity(username)

        return jsonify({
            'success': True,
            'data': {
                'username': username,
                'available': is_available and not has_profanity,
                'has_profanity': has_profanity
            }
        }), 200

    except Exception as e:
        logger.error(f"Check username error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to check username availability']}), 500


@users_bp.route('/check-email', methods=['POST'])
def check_email_availability():
    """Check if an email is available (for registration)."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()

        if not email:
            return jsonify({'success': False, 'errors': ['Email is required']}), 400

        from utils.validators import validate_email
        if not validate_email(email):
            return jsonify({'success': False, 'errors': ['Invalid email format']}), 400

        from flask import current_app
        user_model = User(current_app.db)

        # Check if email exists
        existing_user = user_model.get_user_by_email(email)
        is_available = existing_user is None

        return jsonify({
            'success': True,
            'data': {
                'email': email,
                'available': is_available
            }
        }), 200

    except Exception as e:
        logger.error(f"Check email error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to check email availability']}), 500