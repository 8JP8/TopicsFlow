from flask import Blueprint, request, jsonify, current_app
from flask_socketio import emit
from services.auth_service import AuthService
from models.message import Message
from models.topic import Topic
from utils.validators import validate_message_content, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
messages_bp = Blueprint('messages', __name__)


@messages_bp.route('/topic/<topic_id>', methods=['GET'])
@log_requests
def get_topic_messages(topic_id):
    """Get messages for a topic with pagination."""
    try:
        # Parse query parameters
        limit = int(request.args.get('limit', 50))
        before_message_id = request.args.get('before_message_id')

        # Validate pagination
        pagination_result = validate_pagination_params(limit, 0)
        if not pagination_result['valid']:
            return jsonify({'success': False, 'errors': pagination_result['errors']}), 400

        limit = pagination_result['limit']

        message_model = Message(current_app.db)

        # Get current user ID if authenticated
        user_id = None
        try:
            auth_service = AuthService(current_app.db)
            if auth_service.is_authenticated():
                current_user_result = auth_service.get_current_user()
                if current_user_result.get('success'):
                    user_id = current_user_result['user']['id']
        except:
            pass  # Continue without user_id if auth check fails

        # Get messages
        messages = message_model.get_messages(
            topic_id=topic_id,
            limit=limit,
            before_message_id=before_message_id,
            user_id=user_id
        )

        return jsonify({
            'success': True,
            'data': messages
        }), 200

    except Exception as e:
        logger.error(f"Get topic messages error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get messages']}), 500


@messages_bp.route('/topic/<topic_id>', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_message(topic_id):
    """Create a new message in a topic."""
    try:
        data = request.get_json()
        content = data.get('content', '').strip()
        message_type = data.get('message_type', 'text')
        use_anonymous = data.get('use_anonymous', False)
        gif_url = data.get('gif_url')

        # Allow empty content if it's a GIF message
        if not content and not gif_url:
            return jsonify({'success': False, 'errors': ['Message content or GIF URL is required']}), 400
        
        # If it's a GIF message but no content, set a default
        if message_type == 'gif' and gif_url and not content:
            content = '[GIF]'

        # Validate message content
        validation_result = validate_message_content(content)
        if not validation_result['valid']:
            return jsonify({'success': False, 'errors': validation_result['errors']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        # Verify topic exists and user has access
        topic_model = Topic(current_app.db)
        topic = topic_model.get_topic_by_id(topic_id)

        if not topic:
            return jsonify({'success': False, 'errors': ['Topic not found']}), 404

        # Check if user is banned from topic
        if topic_model.is_user_banned_from_topic(topic_id, user_id):
            return jsonify({'success': False, 'errors': ['You are banned from this topic']}), 403

        # Handle anonymous identity
        anonymous_identity = None
        if use_anonymous and topic.get('settings', {}).get('allow_anonymous', True):
            from models.anonymous_identity import AnonymousIdentity
            anon_model = AnonymousIdentity(current_app.db)
            anonymous_identity = anon_model.get_anonymous_identity(user_id, topic_id)

        # Create message
        message_model = Message(current_app.db)
        message_id = message_model.create_message(
            topic_id=topic_id,
            user_id=user_id,
            content=content,
            message_type=message_type,
            anonymous_identity=anonymous_identity,
            gif_url=gif_url
        )

        # Get created message
        new_message = message_model.get_message_by_id(message_id)
        if not new_message:
            return jsonify({'success': False, 'errors': ['Failed to create message']}), 500

        # Emit socket event to broadcast message to other users
        try:
            # Import socketio from app module
            from app import socketio
            if socketio:
                # Get user details for broadcast
                from models.user import User
                user_model = User(current_app.db)
                user = user_model.get_user_by_id(user_id)
                
                # Prepare broadcast message
                from datetime import datetime
                created_at_str = new_message.get('created_at', '')
                if isinstance(created_at_str, datetime):
                    created_at_str = created_at_str.isoformat()
                elif not isinstance(created_at_str, str):
                    created_at_str = str(created_at_str)
                
                broadcast_message = {
                    'id': str(new_message.get('id') or new_message.get('_id', '')),
                    'topic_id': str(new_message.get('topic_id', '')),
                    'user_id': str(new_message.get('user_id', '')),
                    'content': new_message.get('content', ''),
                    'message_type': new_message.get('message_type', 'text'),
                    'gif_url': new_message.get('gif_url'),
                    'created_at': created_at_str,
                    'display_name': new_message.get('display_name', user.get('username', 'Unknown') if user else 'Unknown'),
                    'sender_username': new_message.get('sender_username', user.get('username', 'Unknown') if user else 'Unknown'),
                    'is_anonymous': new_message.get('is_anonymous', False),
                    'can_delete': new_message.get('can_delete', False)
                }
                
                # Broadcast to topic room
                room_name = f"topic_{topic_id}"
                socketio.emit('new_message', broadcast_message, room=room_name)
                logger.info(f"Emitted new_message event to room {room_name} for message {message_id}")
        except Exception as e:
            logger.warning(f"Failed to emit socket event for message {message_id}: {str(e)}")
            # Don't fail the request if socket emission fails

        return jsonify({
            'success': True,
            'message': 'Message created successfully',
            'data': new_message
        }), 201

    except Exception as e:
        logger.error(f"Create message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create message: {str(e)}']}), 500


@messages_bp.route('/<message_id>', methods=['GET'])
@log_requests
def get_message(message_id):
    """Get a specific message by ID."""
    try:
        message_model = Message(current_app.db)

        message = message_model.get_message_by_id(message_id)
        if not message:
            return jsonify({'success': False, 'errors': ['Message not found']}), 404

        return jsonify({
            'success': True,
            'data': message
        }), 200

    except Exception as e:
        logger.error(f"Get message error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get message']}), 500


@messages_bp.route('/<message_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_message(message_id):
    """Delete a message (moderator, owner, or message author)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        message_model = Message(current_app.db)
        success = message_model.delete_message(message_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Message deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or message not found']}), 403

    except Exception as e:
        logger.error(f"Delete message error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to delete message']}), 500


@messages_bp.route('/<message_id>/report', methods=['POST'])
@require_json
@require_auth()
@log_requests
def report_message(message_id):
    """Report a message for moderation."""
    try:
        data = request.get_json()
        reason = data.get('reason', '').strip()

        if not reason:
            return jsonify({'success': False, 'errors': ['Report reason is required']}), 400

        if len(reason) < 3 or len(reason) > 500:
            return jsonify({'success': False, 'errors': ['Reason must be between 3 and 500 characters']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        message_model = Message(current_app.db)
        success = message_model.report_message(message_id, user_id, reason)

        if success:
            return jsonify({
                'success': True,
                'message': 'Message reported successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to report message or already reported']}), 400

    except Exception as e:
        logger.error(f"Report message error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to report message']}), 500


@messages_bp.route('/<message_id>/reports', methods=['GET'])
@require_auth()
@log_requests
def get_message_reports(message_id):
    """Get reports for a specific message (moderator/owner only)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        message_model = Message(current_app.db)
        message = message_model.get_message_by_id(message_id)

        if not message:
            return jsonify({'success': False, 'errors': ['Message not found']}), 404

        # Check if user has permission to view reports
        topic_model = Topic(current_app.db)
        permission_level = topic_model.get_user_permission_level(message['topic_id'], user_id)

        if permission_level < 2:  # Not moderator or owner
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        # Get reports
        reports = message_model.get_message_reports(message_id)

        return jsonify({
            'success': True,
            'data': reports
        }), 200

    except Exception as e:
        logger.error(f"Get message reports error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get message reports']}), 500


@messages_bp.route('/topic/<topic_id>/search', methods=['GET'])
@log_requests
def search_topic_messages(topic_id):
    """Search messages within a topic."""
    try:
        query = request.args.get('q', '').strip()

        if not query:
            return jsonify({'success': False, 'errors': ['Search query is required']}), 400

        if len(query) < 2:
            return jsonify({'success': False, 'errors': ['Search query must be at least 2 characters']}), 400

        message_model = Message(current_app.db)

        # Get current user ID if authenticated
        user_id = None
        auth_service = AuthService(current_app.db)
        if auth_service.is_authenticated():
            current_user_result = auth_service.get_current_user()
            if current_user_result['success']:
                user_id = current_user_result['user']['id']

        # Search messages
        messages = message_model.search_messages(topic_id, query, user_id)

        return jsonify({
            'success': True,
            'data': {
                'messages': messages,
                'query': query,
                'count': len(messages)
            }
        }), 200

    except Exception as e:
        logger.error(f"Search messages error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to search messages']}), 500


@messages_bp.route('/user/<user_id>', methods=['GET'])
@require_auth()
@log_requests
def get_user_messages(user_id):
    """Get recent messages from a specific user."""
    try:
        limit = int(request.args.get('limit', 10))

        if limit < 1 or limit > 50:
            limit = 10

        message_model = Message(current_app.db)

        # Get messages
        messages = message_model.get_recent_messages_from_user(user_id, limit)

        return jsonify({
            'success': True,
            'data': messages
        }), 200

    except Exception as e:
        logger.error(f"Get user messages error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user messages']}), 500


@messages_bp.route('/topic/<topic_id>/stats', methods=['GET'])
@log_requests
def get_topic_message_stats(topic_id):
    """Get message statistics for a topic."""
    try:
        message_model = Message(current_app.db)

        # Get stats
        total_messages = message_model.get_topic_message_count(topic_id)

        return jsonify({
            'success': True,
            'data': {
                'total_messages': total_messages,
                'topic_id': topic_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Get topic message stats error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get topic message stats']}), 500


@messages_bp.route('/topic/<topic_id>/user/<user_id>/count', methods=['GET'])
@require_auth()
@log_requests
def get_user_message_count_in_topic(topic_id, user_id):
    """Get message count for a specific user in a topic."""
    try:
        message_model = Message(current_app.db)

        # Get message count
        count = message_model.get_user_message_count(topic_id, user_id)

        return jsonify({
            'success': True,
            'data': {
                'message_count': count,
                'topic_id': topic_id,
                'user_id': user_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Get user message count error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user message count']}), 500


@messages_bp.route('/private', methods=['GET'])
@require_auth()
@log_requests
def get_private_messages():
    """Get private message conversations for current user."""
    try:
        other_user_id = request.args.get('other_user_id')
        limit = int(request.args.get('limit', 50))
        before_message_id = request.args.get('before_message_id')

        if not other_user_id:
            return jsonify({'success': False, 'errors': ['Other user ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)

        # Get conversation
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
        logger.error(f"Get private messages error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get private messages']}), 500


@messages_bp.route('/private', methods=['POST'])
@require_json
@require_auth()
@log_requests
def send_private_message():
    """Send a private message."""
    try:
        data = request.get_json()
        to_user_id = data.get('to_user_id')
        content = data.get('content', '').strip()
        message_type = data.get('message_type', 'text')
        gif_url = data.get('gif_url')

        if not to_user_id or not content:
            return jsonify({'success': False, 'errors': ['Recipient and content are required']}), 400

        # Validate message content
        validation_result = validate_message_content(content)
        if not validation_result['valid']:
            return jsonify({'success': False, 'errors': validation_result['errors']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)

        # Send message
        message_id = pm_model.send_message(
            from_user_id=user_id,
            to_user_id=to_user_id,
            content=content,
            message_type=message_type,
            gif_url=gif_url
        )

        # Get created message
        new_message = pm_model.get_message_by_id(message_id)
        if not new_message:
            return jsonify({'success': False, 'errors': ['Failed to send message']}), 500

        return jsonify({
            'success': True,
            'message': 'Private message sent successfully',
            'data': new_message
        }), 201

    except Exception as e:
        logger.error(f"Send private message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to send private message: {str(e)}']}), 500


@messages_bp.route('/private/conversations', methods=['GET'])
@require_auth()
@log_requests
def get_private_conversations():
    """Get all private message conversations for current user."""
    try:
        limit = int(request.args.get('limit', 20))

        if limit < 1 or limit > 50:
            limit = 20

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)

        # Get conversations
        conversations = pm_model.get_conversations(user_id, limit)

        return jsonify({
            'success': True,
            'data': conversations
        }), 200

    except Exception as e:
        logger.error(f"Get private conversations error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get private conversations']}), 500


@messages_bp.route('/private/<message_id>/read', methods=['POST'])
@require_auth()
@log_requests
def mark_private_message_read(message_id):
    """Mark a private message as read."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)

        # Mark as read
        success = pm_model.mark_as_read(message_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Message marked as read'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mark message as read']}), 400

    except Exception as e:
        logger.error(f"Mark message read error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to mark message as read']}), 500