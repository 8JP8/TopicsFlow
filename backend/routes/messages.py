from flask import Blueprint, request, jsonify, current_app
from flask_socketio import emit
from services.auth_service import AuthService
from models.message import Message
from models.topic import Topic
from utils.validators import validate_message_content, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
from utils.cache_decorator import cache_result, user_cache_key
import logging

logger = logging.getLogger(__name__)
messages_bp = Blueprint('messages', __name__)


@messages_bp.route('/topic/<topic_id>', methods=['GET'])
@log_requests
@cache_result(ttl=30, key_prefix='messages:topic')
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
        attachments = data.get('attachments', [])

        # For GIF messages, content can be empty if gif_url is provided
        if message_type == 'gif' and gif_url:
            if not content:
                content = '[GIF]'
        elif attachments and len(attachments) > 0:
            # For attachment messages, content can be empty
            if not content:
                content = '[Attachment]'
        else:
            # For non-GIF, non-attachment messages, content is required
            if not content:
                return jsonify({'success': False, 'errors': ['Message content, GIF URL, or attachment is required']}), 400

        # Validate message content
        if message_type != 'gif' and content and content != '[GIF]' and content != '[Attachment]':
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

        # Process attachments: convert base64 to files and store them
        if attachments:
            from services.file_storage import FileStorageService
            from utils.file_helpers import process_attachments
            
            use_azure = current_app.config.get('USE_AZURE_STORAGE', False)
            file_storage = FileStorageService(
                uploads_dir=current_app.config.get('UPLOADS_DIR'),
                use_azure=use_azure
            )
            
            # Get secret key for encryption
            secret_key = current_app.config.get('FILE_ENCRYPTION_KEY') or current_app.config.get('SECRET_KEY')
            
            processed_attachments, errors = process_attachments(
                attachments,
                file_storage,
                user_id=user_id,
                secret_key=secret_key,
                request=request
            )
            
            if errors:
                logger.warning(f"Errors processing attachments: {errors}")
            
            attachments = processed_attachments

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
            gif_url=gif_url,
            attachments=attachments if attachments else None
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
                
                # Don't expose real user_id when anonymous
                is_anonymous = new_message.get('is_anonymous', False)
                broadcast_message = {
                    'id': str(new_message.get('id') or new_message.get('_id', '')),
                    'topic_id': str(new_message.get('topic_id', '')),
                    'user_id': '' if is_anonymous else str(new_message.get('user_id', '')),  # Hide user_id for anonymous
                    'content': new_message.get('content', ''),
                    'message_type': new_message.get('message_type', 'text'),
                    'gif_url': new_message.get('gif_url'),
                    'attachments': new_message.get('attachments', []),
                    'created_at': created_at_str,
                    'display_name': new_message.get('display_name', user.get('username', 'Unknown') if user else 'Unknown'),
                    'sender_username': new_message.get('sender_username', user.get('username', 'Unknown') if user else 'Unknown'),
                    'is_anonymous': is_anonymous,
                    'can_delete': new_message.get('can_delete', False)
                }
                
                # Broadcast to topic room
                room_name = f"topic_{topic_id}"
                socketio.emit('new_message', broadcast_message, room=room_name)
                logger.info(f"Emitted new_message event to room {room_name} for message {message_id}")
        except Exception as e:
            logger.warning(f"Failed to emit socket event for message {message_id}: {str(e)}")
            # Don't fail the request if socket emission fails

        # Invalidate topic messages cache
        try:
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"messages:topic:{topic_id}*")
            # Also invalidate topic stats if cached
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"messages:stats:topic:{topic_id}*")
        except Exception as e:
            logger.error(f"Cache invalidation failed: {e}")

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
    """Delete a message (moderator, owner, or message author). Supports deletion with reason for chat owners."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        # Support both JSON data and query params
        data = request.get_json() if request.is_json else {}
        deletion_reason = data.get('deletion_reason') if data else request.args.get('reason')
        mode = request.args.get('mode', 'soft')

        message_model = Message(current_app.db)
        message = message_model.get_message_by_id(message_id)
        
        if not message:
            return jsonify({'success': False, 'errors': ['Message not found']}), 404

        # Check if user is owner (requires reason) or can delete without reason
        is_owner_deletion = False
        if message.get('chat_room_id'):
            from models.chat_room import ChatRoom
            chat_room_model = ChatRoom(current_app.db)
            permission_level = chat_room_model.get_user_permission_level(
                str(message['chat_room_id']), 
                user_id
            )
            is_owner_deletion = permission_level == 3 and str(message.get('user_id')) != user_id
        
        # If owner deleting someone else's message, require reason
        if is_owner_deletion and not deletion_reason:
            return jsonify({'success': False, 'errors': ['Deletion reason is required for owner deletions']}), 400

        success = message_model.delete_message(message_id, user_id, deletion_reason, mode)

        if success:
            # If owner deleted with reason, create a report for admin
            if is_owner_deletion and deletion_reason:
                from models.report import Report
                report_model = Report(current_app.db)
                report_model.create_report(
                    reporter_id=user_id,
                    reported_user_id=str(message.get('user_id')),
                    reason=deletion_reason,
                    description=f"Message deleted by chat owner. Message ID: {message_id}",
                    content_type='message',
                    report_type='message_deleted',
                    related_message_id=message_id
                )
            
            # Invalidate caches
            try:
                # Need topic_id/chat_room_id to invalidate correctly
                # Message object (L255) has topic_id
                if message.get('topic_id'):
                    topic_id = message['topic_id']
                    current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"messages:topic:{topic_id}*")
                
                # If private message (unlikely in this route but good to handle if shared logic),
                # but delete_message route below handles PMs. This route seems to be for Topic/ChatRoom messages.
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': f'Message {"permanently " if mode == "hard" else ""}deleted successfully'
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
@cache_result(ttl=60, key_prefix='messages:stats:topic')
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
@cache_result(ttl=30, key_prefix='messages:private', key_func=user_cache_key('messages:private'))
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
        attachments = data.get('attachments', [])

        if not to_user_id:
            return jsonify({'success': False, 'errors': ['Recipient is required']}), 400

        # For GIF messages, content can be empty if gif_url is provided
        if message_type == 'gif' and gif_url:
            # Allow empty content for GIF messages
            if not content:
                content = '[GIF]'  # Set default content for GIF messages
        elif attachments and len(attachments) > 0:
            # For attachment messages, content can be empty
            if not content:
                content = '[Attachment]'  # Set default content for attachment messages
        else:
            # For non-GIF, non-attachment messages, content is required
            if not content:
                return jsonify({'success': False, 'errors': ['Message content is required']}), 400

        # Validate message content (skip validation for GIF/attachment messages with default content)
        if message_type != 'gif' and content and content != '[GIF]' and content != '[Attachment]':
            validation_result = validate_message_content(content)
            if not validation_result['valid']:
                return jsonify({'success': False, 'errors': validation_result['errors']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        # Process attachments: convert base64 to files and store them
        if attachments:
            from services.file_storage import FileStorageService
            from utils.file_helpers import process_attachments
            
            use_azure = current_app.config.get('USE_AZURE_STORAGE', False)
            file_storage = FileStorageService(
                uploads_dir=current_app.config.get('UPLOADS_DIR'),
                use_azure=use_azure
            )
            
            # Get secret key for encryption
            secret_key = current_app.config.get('FILE_ENCRYPTION_KEY') or current_app.config.get('SECRET_KEY')
            
            processed_attachments, errors = process_attachments(
                attachments,
                file_storage,
                user_id=user_id,
                secret_key=secret_key,
                request=request
            )
            
            if errors:
                logger.warning(f"Errors processing attachments: {errors}")
            
            attachments = processed_attachments

        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)

        # Send message
        try:
            message_id = pm_model.send_message(
                from_user_id=user_id,
                to_user_id=to_user_id,
                content=content,
                message_type=message_type,
                gif_url=gif_url,
                attachments=attachments if attachments else None
            )
        except ValueError as e:
            # Handle specific error messages from send_message
            return jsonify({'success': False, 'errors': [str(e)]}), 400

        # Get created message
        new_message = pm_model.get_message_by_id(message_id)
        if not new_message:
            return jsonify({'success': False, 'errors': ['Failed to send message']}), 500

        # Create notification for recipient (if not muted)
        try:
            from models.notification_settings import NotificationSettings
            from models.notification import Notification
            from app import socketio
            
            notification_settings = NotificationSettings(current_app.db)
            notification_model = Notification(current_app.db)
            
            # Check if private messages from this user are muted for the recipient
            if not notification_settings.is_private_message_muted(to_user_id, user_id):
                # Get sender username
                from models.user import User
                user_model = User(current_app.db)
                sender = user_model.get_user_by_id(user_id)
                sender_username = sender.get('username', 'Unknown') if sender else 'Unknown'
                
                # Create preview of message
                preview = content[:50] + ('...' if len(content) > 50 else '')
                if message_type == 'gif' and gif_url:
                    preview = '[GIF]'
                elif attachments and len(attachments) > 0:
                    preview = '[Attachment]'
                
                # Create notification
                notification_id = notification_model.create_notification(
                    user_id=to_user_id,
                    notification_type='message',
                    title='New message',
                    message=f'New message from {sender_username}',
                    data={
                        'from_user_id': user_id,
                        'from_username': sender_username,
                        'message_id': message_id,
                        'preview': preview
                    },
                    sender_id=user_id,
                    context_id=to_user_id,
                    context_type='private_message'
                )
                
                # Emit real-time notification via socket
                if notification_id and socketio:
                    try:
                        user_room = f"user_{to_user_id}"
                        socketio.emit('new_notification', {
                            'id': notification_id,
                            'type': 'message',
                            'title': 'New message',
                            'message': f'New message from {sender_username}',
                            'data': {
                                'from_user_id': user_id,
                                'from_username': sender_username,
                                'message_id': message_id,
                                'preview': preview
                            },
                            'sender_username': sender_username,
                            'timestamp': new_message.get('created_at')
                        }, room=user_room)
                        logger.info(f"Emitted new_notification for private message to user {to_user_id}")
                    except Exception as e:
                        logger.warning(f"Failed to emit notification socket event: {str(e)}")
        except Exception as e:
            logger.warning(f"Failed to create notification for private message: {str(e)}")

        # Invalidate private message caches for both sender and receiver
        try:
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"messages:private:user:{user_id}*")
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"messages:private:user:{to_user_id}*")
            # Also invalidate conversation lists
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"user:pm_conversations:user:{user_id}*")
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"user:pm_conversations:user:{to_user_id}*")
        except Exception as e:
            logger.error(f"Cache invalidation failed: {e}")

        return jsonify({
            'success': True,
            'message': 'Private message sent successfully',
            'data': new_message
        }), 201

    except Exception as e:
        logger.error(f"Send private message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to send private message: {str(e)}']}), 500


@messages_bp.route('/private/<message_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_private_message(message_id):
    """Delete a private message. Defaults to soft delete (for me). Optional mode='hard' for unsend (sender only)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)
        
        # Check if message exists and belongs to user
        message = pm_model.get_message_by_id(message_id)
        if not message:
             return jsonify({'success': False, 'errors': ['Message not found']}), 404
             
        if str(message['from_user_id']) != user_id and str(message['to_user_id']) != user_id:
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        mode = request.args.get('mode', 'soft')

        if mode == 'hard':
            # Hard delete (Unsend) - only allowed for sender
            if str(message['from_user_id']) != user_id:
                return jsonify({'success': False, 'errors': ['Only sender can unsend message']}), 403
            success = pm_model.delete_message(message_id, user_id)
        else:
            # Soft delete (Delete for me)
            success = pm_model.delete_message_for_me(message_id, user_id)

        if success:
            # Invalidate caches
            try:
                # We need other user ID to invalidate their cache too if hard delete (unsend)
                # But even for soft delete, WE need to invalidate OUR cache.
                from_id = str(message['from_user_id'])
                to_id = str(message['to_user_id'])
                
                # Invalidate my cache
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"messages:private:user:{user_id}*")
                
                # If hard delete, invalidate other user's cache too
                if mode == 'hard':
                    other_id = to_id if from_id == user_id else from_id
                    current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f"messages:private:user:{other_id}*")
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Message deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to delete message']}), 400

    except Exception as e:
        logger.error(f"Delete private message error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to delete message']}), 500


@messages_bp.route('/private/<message_id>/report', methods=['POST'])
@require_json
@require_auth()
@log_requests
def report_private_message(message_id):
    """Report a private message for moderation."""
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

        from models.private_message import PrivateMessage
        pm_model = PrivateMessage(current_app.db)
        message = pm_model.get_message_by_id(message_id)
        
        if not message:
            return jsonify({'success': False, 'errors': ['Message not found']}), 404

        # Verify user has access to this message (sender or receiver)
        if str(message['from_user_id']) != user_id and str(message['to_user_id']) != user_id:
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        from models.report import Report
        report_model = Report(current_app.db)
        
        from bson import ObjectId
        # Check if already reported by this user
        existing_report = report_model.collection.find_one({
            'reported_content_id': ObjectId(message_id),
            'reported_by': ObjectId(user_id),
            'content_type': 'private_message'
        })
        
        if existing_report:
             return jsonify({'success': False, 'errors': ['You have already reported this message']}), 400

        # Create report
        report_id = report_model.create_report(
            reporter_id=user_id,
            reason=reason,
            content_type='private_message',
            content_id=message_id,
            reported_user_id=str(message['from_user_id'])  # Report against the sender
        )

        return jsonify({
            'success': True,
            'message': 'Message reported successfully',
            'data': {'report_id': report_id}
        }), 200

    except Exception as e:
        logger.error(f"Report private message error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to report message']}), 500


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