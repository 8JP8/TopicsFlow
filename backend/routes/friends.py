from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.friend_request import FriendRequest
from utils.decorators import require_auth, require_json, log_requests, rate_limit
from utils.cache_decorator import cache_result, user_cache_key
from utils.rate_limits import FRIEND_LIMITS
import logging

logger = logging.getLogger(__name__)
friends_bp = Blueprint('friends', __name__)


@friends_bp.route('/requests/send', methods=['POST'])
@require_json
@require_auth()
@rate_limit(FRIEND_LIMITS['send_request'])
@log_requests
def send_friend_request():
    """Send a friend request to another user."""
    try:
        data = request.get_json()
        to_user_id = data.get('to_user_id')

        if not to_user_id:
            return jsonify({'success': False, 'errors': ['User ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        from_user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        result = friend_request_model.send_friend_request(from_user_id, to_user_id)

        if result['success']:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_user_friends(from_user_id)
                current_app.config['CACHE_INVALIDATOR'].invalidate_user_friends(to_user_id)
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify(result), 201
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Send friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to send friend request: {str(e)}']}), 500


@friends_bp.route('/requests/<request_id>/accept', methods=['POST'])
@require_auth()
@rate_limit(FRIEND_LIMITS['accept'])
@log_requests
def accept_friend_request(request_id):
    """Accept a friend request."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        result = friend_request_model.accept_friend_request(request_id, user_id)

        if result['success']:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_user_friends(user_id)
                # To invalidate the other user properly we would need their ID, 
                # but we don't fetch the request details here. 
                # In a real scenario, we should fetch request first or have model return IDs.
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Accept friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to accept friend request: {str(e)}']}), 500


@friends_bp.route('/requests/<request_id>/reject', methods=['POST'])
@require_auth()
@rate_limit(FRIEND_LIMITS['reject'])
@log_requests
def reject_friend_request(request_id):
    """Reject a friend request."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        result = friend_request_model.reject_friend_request(request_id, user_id)

        if result['success']:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_user_friends(user_id)
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Reject friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to reject friend request: {str(e)}']}), 500


@friends_bp.route('/requests/<request_id>/cancel', methods=['DELETE'])
@require_auth()
@rate_limit(FRIEND_LIMITS['cancel'])
@log_requests
def cancel_friend_request(request_id):
    """Cancel a sent friend request."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        result = friend_request_model.cancel_friend_request(request_id, user_id)

        if result['success']:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_user_friends(user_id)
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Cancel friend request error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to cancel friend request: {str(e)}']}), 500


@friends_bp.route('/requests/pending', methods=['GET'])
@require_auth()
@rate_limit(FRIEND_LIMITS['list'])
@cache_result(ttl=300, key_prefix='friends:pending', key_func=user_cache_key('friends:pending'))
@log_requests
def get_pending_requests():
    """Get pending friend requests received by current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        requests = friend_request_model.get_pending_requests(user_id)

        return jsonify({
            'success': True,
            'data': requests,
            'count': len(requests)
        }), 200

    except Exception as e:
        logger.error(f"Get pending requests error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get pending requests: {str(e)}']}), 500


@friends_bp.route('/requests/sent', methods=['GET'])
@require_auth()
@rate_limit(FRIEND_LIMITS['list'])
@cache_result(ttl=300, key_prefix='friends:sent', key_func=user_cache_key('friends:sent'))
@log_requests
def get_sent_requests():
    """Get pending friend requests sent by current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        requests = friend_request_model.get_sent_requests(user_id)

        return jsonify({
            'success': True,
            'data': requests,
            'count': len(requests)
        }), 200

    except Exception as e:
        logger.error(f"Get sent requests error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get sent requests: {str(e)}']}), 500


@friends_bp.route('/', methods=['GET'])
@require_auth()
@rate_limit(FRIEND_LIMITS['list'])
@cache_result(ttl=300, key_prefix='friends:list', key_func=user_cache_key('friends:list'))
@log_requests
def get_friends():
    """Get list of current user's friends."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        friends = friend_request_model.get_friends(user_id)

        return jsonify({
            'success': True,
            'data': friends,
            'count': len(friends)
        }), 200

    except Exception as e:
        logger.error(f"Get friends error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get friends: {str(e)}']}), 500


@friends_bp.route('/<friend_id>', methods=['DELETE'])
@require_auth()
@rate_limit(FRIEND_LIMITS['unfriend'])
@log_requests
def unfriend(friend_id):
    """Remove a friend."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        result = friend_request_model.unfriend(user_id, friend_id)

        if result['success']:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_user_friends(user_id)
                current_app.config['CACHE_INVALIDATOR'].invalidate_user_friends(friend_id)
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Unfriend error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unfriend: {str(e)}']}), 500


@friends_bp.route('/check/<user_id>', methods=['GET'])
@require_auth()
@cache_result(ttl=60, key_prefix='friends:check', key_func=user_cache_key('friends:check'))
@log_requests
def check_friendship(user_id):
    """Check if current user is friends with another user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        current_user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        are_friends = friend_request_model.are_friends(current_user_id, user_id)

        return jsonify({
            'success': True,
            'are_friends': are_friends
        }), 200

    except Exception as e:
        logger.error(f"Check friendship error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to check friendship: {str(e)}']}), 500


@friends_bp.route('/count', methods=['GET'])
@require_auth()
@cache_result(ttl=60, key_prefix='friends:count', key_func=user_cache_key('friends:count'))
@log_requests
def get_friend_count():
    """Get count of current user's friends and pending requests."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        friend_request_model = FriendRequest(current_app.db)
        friend_count = friend_request_model.get_friend_count(user_id)
        pending_count = friend_request_model.get_pending_request_count(user_id)

        return jsonify({
            'success': True,
            'data': {
                'friends': friend_count,
                'pending_requests': pending_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get friend count error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get friend count: {str(e)}']}), 500
