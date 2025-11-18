from flask import Blueprint, request, jsonify, current_app, session
from bson import ObjectId
from services.auth_service import AuthService
from models.user import User
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from models.private_message import PrivateMessage
from models.conversation_settings import ConversationSettings
from models.friend import Friend
from utils.decorators import require_auth, require_json, log_requests
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


@users_bp.route('/profile', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_user_profile():
    """Update current user's profile (username and/or profile picture)."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()

        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        user_id = current_user_result['user']['id']
        data = request.get_json()
        username = data.get('username')
        profile_picture = data.get('profile_picture')

        if not username and not profile_picture:
            return jsonify({'success': False, 'errors': ['Username or profile picture required']}), 400

        user_model = User(current_app.db)
        update_data = {}

        if username:
            # Check if username is available
            existing_user = user_model.get_user_by_username(username)
            if existing_user and str(existing_user['_id']) != user_id:
                return jsonify({'success': False, 'errors': ['Username already taken']}), 400
            update_data['username'] = username

        if profile_picture:
            update_data['profile_picture'] = profile_picture

        success = user_model.update_user(user_id, update_data)

        if success:
            updated_user = user_model.get_user_by_id(user_id)
            return jsonify({
                'success': True,
                'message': 'Profile updated successfully',
                'data': updated_user
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to update profile']}), 500

    except Exception as e:
        logger.error(f"Update user profile error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to update profile: {str(e)}']}), 500


@users_bp.route('/<user_id>', methods=['GET'])
@require_auth()
@log_requests
def get_user(user_id):
    """Get user by ID."""
    try:
        from flask import current_app
        user_model = User(current_app.db)
        user = user_model.get_user_by_id(user_id)

        if not user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404

        return jsonify({
            'success': True,
            'data': user
        }), 200

    except Exception as e:
        logger.error(f"Get user error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user']}), 500


@users_bp.route('/username/<username>', methods=['GET'])
@require_auth()
@log_requests
def get_user_by_username(username):
    """Get user by username."""
    try:
        from flask import current_app
        user_model = User(current_app.db)
        user = user_model.get_user_by_username(username)

        if not user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404

        return jsonify({
            'success': True,
            'data': user
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

        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

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

        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

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
    """Delete an anonymous identity for a specific topic."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()

        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        user_id = current_user_result['user']['id']
        anon_model = AnonymousIdentity(current_app.db)
        success = anon_model.delete_identity(user_id, topic_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Anonymous identity deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to delete anonymous identity']}), 500

    except Exception as e:
        logger.error(f"Delete anonymous identity error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to delete anonymous identity']}), 500


@users_bp.route('/private-messages/conversations', methods=['GET'])
@require_auth()
@log_requests
def get_private_conversations():
    """Get list of private message conversations."""
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
        logger.error(f"Get private conversations error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get private conversations: {str(e)}']}), 500


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
        logger.error(f"Get private conversation error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get private conversation: {str(e)}']}), 500


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
        logger.error(f"Mark conversation read error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mark conversation as read: {str(e)}']}), 500


@users_bp.route('/private-messages/<other_user_id>/mute', methods=['POST'])
@require_json
@require_auth()
@log_requests
def mute_conversation(other_user_id):
    """Mute a conversation for a specified duration."""
    try:
        data = request.get_json()
        minutes = int(data.get('minutes', 0))
        
        if minutes < -1:
            return jsonify({'success': False, 'errors': ['Invalid mute duration']}), 400
        
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']
        
        settings_model = ConversationSettings(current_app.db)
        success = settings_model.mute_conversation(user_id, other_user_id, minutes)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Conversation muted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': ['Failed to mute conversation']
            }), 500
            
    except Exception as e:
        logger.error(f"Mute conversation error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute conversation: {str(e)}']}), 500


@users_bp.route('/block/<other_user_id>', methods=['POST'])
@require_auth()
@log_requests
def block_user(other_user_id):
    """Block a user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']
        
        if user_id == other_user_id:
            return jsonify({'success': False, 'errors': ['Cannot block yourself']}), 400
        
        settings_model = ConversationSettings(current_app.db)
        success = settings_model.block_user(user_id, other_user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'User blocked successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': ['Failed to block user']
            }), 500
            
    except Exception as e:
        logger.error(f"Block user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to block user: {str(e)}']}), 500


@users_bp.route('/private-messages/<other_user_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_conversation(other_user_id):
    """Delete all messages in a conversation."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']
        
        pm_model = PrivateMessage(current_app.db)
        
        # Delete all messages in the conversation
        result = pm_model.collection.delete_many({
            '$or': [
                {'from_user_id': ObjectId(user_id), 'to_user_id': ObjectId(other_user_id)},
                {'from_user_id': ObjectId(other_user_id), 'to_user_id': ObjectId(user_id)}
            ]
        })
        
        return jsonify({
            'success': True,
            'message': f'Deleted {result.deleted_count} messages',
            'data': {
                'deleted_count': result.deleted_count
            }
        }), 200
            
    except Exception as e:
        logger.error(f"Delete conversation error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to delete conversation: {str(e)}']}), 500


# Friends routes
@users_bp.route('/friends', methods=['GET'])
@require_auth()
@log_requests
def get_friends():
    """Get all friends of current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        friend_model = Friend(current_app.db)
        friends = friend_model.get_friends(user_id)

        return jsonify({
            'success': True,
            'data': friends
        }), 200

    except Exception as e:
        logger.error(f"Get friends error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get friends: {str(e)}']}), 500


@users_bp.route('/friends/requests', methods=['GET'])
@require_auth()
@log_requests
def get_friend_requests():
    """Get pending friend requests (sent and received)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        friend_model = Friend(current_app.db)
        requests = friend_model.get_pending_requests(user_id)

        return jsonify({
            'success': True,
            'data': requests
        }), 200

    except Exception as e:
        logger.error(f"Get friend requests error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get friend requests: {str(e)}']}), 500


@users_bp.route('/friends/request', methods=['POST'])
@require_json
@require_auth()
@log_requests
def send_friend_request():
    """Send a friend request."""
    try:
        data = request.get_json()
        to_user_id = data.get('to_user_id')

        if not to_user_id:
            return jsonify({'success': False, 'errors': ['to_user_id is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        from_user_id = current_user_result['user']['id']

        friend_model = Friend(current_app.db)
        result = friend_model.send_friend_request(from_user_id, to_user_id)

        return jsonify({
            'success': True,
            'data': result,
            'message': 'Friend request sent successfully'
        }), 200

    except ValueError as e:
        return jsonify({'success': False, 'errors': [str(e)]}), 400
    except Exception as e:
        logger.error(f"Send friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to send friend request: {str(e)}']}), 500


@users_bp.route('/friends/request/<request_id>/accept', methods=['POST'])
@require_auth()
@log_requests
def accept_friend_request(request_id):
    """Accept a friend request."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        friend_model = Friend(current_app.db)
        result = friend_model.accept_friend_request(request_id, user_id)

        return jsonify({
            'success': True,
            'data': result,
            'message': 'Friend request accepted'
        }), 200

    except ValueError as e:
        return jsonify({'success': False, 'errors': [str(e)]}), 400
    except Exception as e:
        logger.error(f"Accept friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to accept friend request: {str(e)}']}), 500


@users_bp.route('/friends/request/<request_id>/reject', methods=['POST'])
@require_auth()
@log_requests
def reject_friend_request(request_id):
    """Reject a friend request."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        friend_model = Friend(current_app.db)
        success = friend_model.reject_friend_request(request_id, user_id)

        if not success:
            return jsonify({'success': False, 'errors': ['Friend request not found']}), 404

        return jsonify({
            'success': True,
            'message': 'Friend request rejected'
        }), 200

    except Exception as e:
        logger.error(f"Reject friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to reject friend request: {str(e)}']}), 500


@users_bp.route('/friends/request/<request_id>/cancel', methods=['POST'])
@require_auth()
@log_requests
def cancel_friend_request(request_id):
    """Cancel a sent friend request."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        friend_model = Friend(current_app.db)
        success = friend_model.cancel_friend_request(request_id, user_id)

        if not success:
            return jsonify({'success': False, 'errors': ['Friend request not found']}), 404

        return jsonify({
            'success': True,
            'message': 'Friend request cancelled'
        }), 200

    except Exception as e:
        logger.error(f"Cancel friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to cancel friend request: {str(e)}']}), 500


@users_bp.route('/friends/<friend_id>', methods=['DELETE'])
@require_auth()
@log_requests
def remove_friend(friend_id):
    """Remove a friend."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        friend_model = Friend(current_app.db)
        success = friend_model.remove_friend(user_id, friend_id)

        if not success:
            return jsonify({'success': False, 'errors': ['Friend not found']}), 404

        return jsonify({
            'success': True,
            'message': 'Friend removed'
        }), 200

    except Exception as e:
        logger.error(f"Remove friend error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to remove friend: {str(e)}']}), 500


@users_bp.route('/search', methods=['GET'])
@require_auth()
@log_requests
def search_users():
    """Search users by username or email."""
    try:
        query = request.args.get('q', '').strip()

        if not query:
            return jsonify({'success': False, 'errors': ['Search query is required']}), 400

        if len(query) < 2:
            return jsonify({'success': False, 'errors': ['Search query must be at least 2 characters']}), 400

        from flask import current_app
        user_model = User(current_app.db)
        users = user_model.search_users(query, limit=10)

        return jsonify({
            'success': True,
            'data': users
        }), 200

    except Exception as e:
        logger.error(f"Search users error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to search users: {str(e)}']}), 500


@users_bp.route('/stats', methods=['GET'])
@require_auth()
@log_requests
def get_user_stats():
    """Get user statistics."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()

        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        user_id = current_user_result['user']['id']
        user_model = User(current_app.db)
        topic_model = Topic(current_app.db)
        pm_model = PrivateMessage(current_app.db)

        stats = {
            'topics_joined': len(topic_model.get_user_topics(user_id)),
            'messages_sent': pm_model.get_message_count(user_id),
            'unread_messages': pm_model.get_unread_count(user_id)
        }

        return jsonify({
            'success': True,
            'data': stats
        }), 200

    except Exception as e:
        logger.error(f"Get user stats error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user stats']}), 500


@users_bp.route('/online', methods=['GET'])
@require_auth()
@log_requests
def get_online_users():
    """Get list of online users."""
    try:
        from flask import current_app
        user_model = User(current_app.db)
        online_users = user_model.get_online_users()

        return jsonify({
            'success': True,
            'data': online_users
        }), 200

    except Exception as e:
        logger.error(f"Get online users error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get online users']}), 500


@users_bp.route('/check-username', methods=['POST'])
@require_json
@log_requests
def check_username():
    """Check if username is available."""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()

        if not username:
            return jsonify({'success': False, 'errors': ['Username is required']}), 400

        from flask import current_app
        user_model = User(current_app.db)
        is_available = user_model.is_username_available(username)

        return jsonify({
            'success': True,
            'data': {
                'username': username,
                'available': is_available
            }
        }), 200

    except Exception as e:
        logger.error(f"Check username error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to check username availability']}), 500


@users_bp.route('/check-email', methods=['POST'])
@require_json
@log_requests
def check_email():
    """Check if email is available."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()

        if not email:
            return jsonify({'success': False, 'errors': ['Email is required']}), 400

        from flask import current_app
        user_model = User(current_app.db)
        is_available = user_model.is_email_available(email)

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
