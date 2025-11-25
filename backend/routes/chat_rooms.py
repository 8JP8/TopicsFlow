from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.chat_room import ChatRoom
from models.message import Message
from models.anonymous_identity import AnonymousIdentity
from utils.validators import validate_message_content, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
chat_rooms_bp = Blueprint('chat_rooms', __name__)


@chat_rooms_bp.route('/topics/<topic_id>/conversations', methods=['GET'])
@log_requests
def get_topic_conversations(topic_id):
    """Get all conversations (chat rooms) for a topic (Discord-style)."""
    try:
        # Validate topic_id
        if not topic_id or topic_id == 'undefined' or topic_id == 'null':
            return jsonify({'success': False, 'errors': ['Topic ID is required']}), 400
        
        # Verify topic exists
        from models.topic import Topic
        topic_model = Topic(current_app.db)
        try:
            topic = topic_model.get_topic_by_id(topic_id)
        except Exception as e:
            logger.error(f"Invalid topic_id format: {topic_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid topic ID format']}), 400
        
        if not topic:
            return jsonify({'success': False, 'errors': ['Topic not found']}), 404

        # Get current user ID if authenticated
        user_id = None
        try:
            auth_service = AuthService(current_app.db)
            if auth_service.is_authenticated():
                current_user_result = auth_service.get_current_user()
                if current_user_result.get('success'):
                    user_id = current_user_result['user']['id']
        except:
            pass

        # Parse query parameters for filtering
        tags = request.args.getlist('tags')
        search = request.args.get('search', '').strip()
        
        chat_room_model = ChatRoom(current_app.db)
        rooms = chat_room_model.get_chat_rooms_by_topic(
            topic_id, 
            user_id,
            tags=tags if tags else None,
            search=search if search else None
        )

        return jsonify({
            'success': True,
            'data': rooms
        }), 200

    except Exception as e:
        logger.error(f"Get theme chat rooms error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get chat rooms: {str(e)}']}), 500


@chat_rooms_bp.route('/topics/<topic_id>/conversations', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_conversation(topic_id):
    """Create a new conversation (chat room) in a topic (Discord-style)."""
    try:
        # Validate topic_id
        if not topic_id or topic_id == 'undefined' or topic_id == 'null':
            return jsonify({'success': False, 'errors': ['Topic ID is required']}), 400
        
        # Verify topic exists
        from models.topic import Topic
        topic_model = Topic(current_app.db)
        try:
            topic = topic_model.get_topic_by_id(topic_id)
        except Exception as e:
            logger.error(f"Invalid topic_id format: {topic_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid topic ID format']}), 400
        
        if not topic:
            return jsonify({'success': False, 'errors': ['Topic not found']}), 404

        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        is_public = data.get('is_public', True)
        tags = data.get('tags', [])

        if not name:
            return jsonify({'success': False, 'errors': ['Conversation name is required']}), 400

        if len(name) > 100:
            return jsonify({'success': False, 'errors': ['Name must be 100 characters or less']}), 400

        if len(description) > 500:
            return jsonify({'success': False, 'errors': ['Description must be 500 characters or less']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        # Create conversation (chat room)
        chat_room_model = ChatRoom(current_app.db)
        room_id = chat_room_model.create_chat_room(
            topic_id=topic_id,
            name=name,
            description=description,
            owner_id=user_id,
            is_public=is_public,
            tags=tags
        )

        # Get created chat room
        new_room = chat_room_model.get_chat_room_by_id(room_id)
        if not new_room:
            return jsonify({'success': False, 'errors': ['Failed to create chat room']}), 500

        return jsonify({
            'success': True,
            'message': 'Chat room created successfully',
            'data': new_room
        }), 201

    except Exception as e:
        logger.error(f"Create chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create chat room: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>', methods=['GET'])
@log_requests
def get_chat_room(room_id):
    """Get a specific chat room by ID."""
    try:
        chat_room_model = ChatRoom(current_app.db)

        room = chat_room_model.get_chat_room_by_id(room_id)
        if not room:
            return jsonify({'success': False, 'errors': ['Chat room not found']}), 404

        return jsonify({
            'success': True,
            'data': room
        }), 200

    except Exception as e:
        logger.error(f"Get chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get chat room: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/join', methods=['POST'])
@require_auth()
@log_requests
def join_chat_room(room_id):
    """Join a chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.join_chat_room(room_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Joined chat room successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to join chat room']}), 400

    except Exception as e:
        logger.error(f"Join chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to join chat room: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/leave', methods=['POST'])
@require_auth()
@log_requests
def leave_chat_room(room_id):
    """Leave a chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.leave_chat_room(room_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Left chat room successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to leave chat room or you are the owner']}), 400

    except Exception as e:
        logger.error(f"Leave chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to leave chat room: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/messages', methods=['GET'])
@log_requests
def get_chat_room_messages(room_id):
    """Get messages for a chat room with pagination."""
    try:
        limit = int(request.args.get('limit', 50))
        before_message_id = request.args.get('before_message_id')

        # Validate pagination
        pagination_result = validate_pagination_params(limit, 0)
        if not pagination_result['valid']:
            return jsonify({'success': False, 'errors': pagination_result['errors']}), 400

        limit = pagination_result['limit']

        # Get current user ID if authenticated
        user_id = None
        try:
            auth_service = AuthService(current_app.db)
            if auth_service.is_authenticated():
                current_user_result = auth_service.get_current_user()
                if current_user_result.get('success'):
                    user_id = current_user_result['user']['id']
        except:
            pass

        # Verify user is member of chat room
        chat_room_model = ChatRoom(current_app.db)
        room = chat_room_model.get_chat_room_by_id(room_id)
        if not room:
            return jsonify({'success': False, 'errors': ['Chat room not found']}), 404

        if user_id and not room.get('is_public', True) and not chat_room_model.is_user_member(room_id, user_id):
            return jsonify({'success': False, 'errors': ['You are not a member of this chat room']}), 403

        # Get messages
        message_model = Message(current_app.db)
        # We need to add a method to get messages by chat_room_id
        # For now, query directly
        from bson import ObjectId
        from datetime import datetime
        
        query = {
            'chat_room_id': ObjectId(room_id),
            'is_deleted': False
        }

        if before_message_id:
            try:
                before_message = current_app.db.messages.find_one({'_id': ObjectId(before_message_id)})
                if before_message:
                    query['created_at'] = {'$lt': before_message['created_at']}
            except:
                pass

        messages = list(current_app.db.messages.find(query)
                       .sort([('created_at', -1)])
                       .limit(limit))

        # Reverse to get chronological order and convert ObjectIds
        messages.reverse()
        for message in messages:
            message['_id'] = str(message['_id'])
            message['id'] = str(message['_id'])
            message['chat_room_id'] = str(message['chat_room_id'])
            message['user_id'] = str(message['user_id'])
            
            # Convert datetime to ISO string
            if 'created_at' in message and isinstance(message['created_at'], datetime):
                message['created_at'] = message['created_at'].isoformat()
            if 'updated_at' in message and isinstance(message['updated_at'], datetime):
                message['updated_at'] = message['updated_at'].isoformat()

            # Get user details (or anonymous identity)
            if message.get('anonymous_identity'):
                message['display_name'] = message['anonymous_identity']
                message['is_anonymous'] = True
                message['sender_username'] = message['anonymous_identity']
            else:
                from models.user import User
                user_model = User(current_app.db)
                user = user_model.get_user_by_id(message['user_id'])
                if user:
                    message['display_name'] = user['username']
                    message['sender_username'] = user['username']
                else:
                    message['display_name'] = 'Deleted User'
                    message['sender_username'] = 'Deleted User'
                message['is_anonymous'] = False

        return jsonify({
            'success': True,
            'data': messages
        }), 200

    except Exception as e:
        logger.error(f"Get chat room messages error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get messages: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/messages', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_chat_room_message(room_id):
    """Create a new message in a chat room."""
    try:
        data = request.get_json()
        content = data.get('content', '').strip()
        message_type = data.get('message_type', 'text')
        use_anonymous = data.get('use_anonymous', False)
        gif_url = data.get('gif_url')

        # Allow empty content if it's a GIF message
        if not content and not gif_url:
            return jsonify({'success': False, 'errors': ['Message content or GIF URL is required']}), 400

        if message_type == 'gif' and gif_url and not content:
            content = '[GIF]'

        # Validate message content
        if content:
            validation_result = validate_message_content(content)
            if not validation_result['valid']:
                return jsonify({'success': False, 'errors': validation_result['errors']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        # Verify chat room exists and user is member
        chat_room_model = ChatRoom(current_app.db)
        room = chat_room_model.get_chat_room_by_id(room_id)
        if not room:
            return jsonify({'success': False, 'errors': ['Chat room not found']}), 404

        # Check if user is banned
        if chat_room_model.is_user_banned_from_chat(room_id, user_id):
            return jsonify({'success': False, 'errors': ['You are banned from this chat room']}), 403

        if not room.get('is_public', True) and not chat_room_model.is_user_member(room_id, user_id):
            return jsonify({'success': False, 'errors': ['You are not a member of this chat room']}), 403

        # Get topic for anonymous identity check
        from models.topic import Topic
        topic_model = Topic(current_app.db)
        topic_id = room.get('topic_id')
        topic = topic_model.get_topic_by_id(topic_id) if topic_id else None

        # Handle anonymous identity
        anonymous_identity = None
        if use_anonymous and topic and topic.get('settings', {}).get('allow_anonymous', True):
            anon_model = AnonymousIdentity(current_app.db)
            anonymous_identity = anon_model.get_anonymous_identity(user_id, topic_id)

        # Create message
        message_model = Message(current_app.db)
        message_id = message_model.create_message(
            chat_room_id=room_id,
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

        # Emit socket event
        try:
            from app import socketio
            if socketio:
                room_name = f"chat_room_{room_id}"
                socketio.emit('new_chat_room_message', new_message, room=room_name)
                logger.info(f"Emitted new_chat_room_message event to room {room_name} for message {message_id}")
        except Exception as e:
            logger.warning(f"Failed to emit socket event for message {message_id}: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Message created successfully',
            'data': new_message
        }), 201

    except Exception as e:
        logger.error(f"Create chat room message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create message: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_chat_room(room_id):
    """Delete a chat room (only owner can delete)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.delete_chat_room(room_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Chat room deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or chat room not found']}), 403

    except Exception as e:
        logger.error(f"Delete chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to delete chat room: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/moderators', methods=['POST'])
@require_json
@require_auth()
@log_requests
def add_chat_moderator(room_id):
    """Add a moderator to a chat room (only owner can add)."""
    try:
        data = request.get_json()
        moderator_id = data.get('user_id')

        if not moderator_id:
            return jsonify({'success': False, 'errors': ['User ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.add_moderator(room_id, user_id, moderator_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Moderator added successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Add chat moderator error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to add moderator: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/moderators/<moderator_id>', methods=['DELETE'])
@require_auth()
@log_requests
def remove_chat_moderator(room_id, moderator_id):
    """Remove a moderator from a chat room (only owner can remove)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.remove_moderator(room_id, user_id, moderator_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Moderator removed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or moderator not found']}), 403

    except Exception as e:
        logger.error(f"Remove chat moderator error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to remove moderator: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/ban/<user_id_to_ban>', methods=['POST'])
@require_auth()
@log_requests
def ban_user_from_chat(room_id, user_id_to_ban):
    """Ban a user from a chat room (owner or moderator can ban)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.ban_user_from_chat(room_id, user_id_to_ban, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'User banned from chat room successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Ban user from chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to ban user: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/unban/<user_id_to_unban>', methods=['POST'])
@require_auth()
@log_requests
def unban_user_from_chat(room_id, user_id_to_unban):
    """Unban a user from a chat room (owner or moderator can unban)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.unban_user_from_chat(room_id, user_id_to_unban, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'User unbanned from chat room successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Unban user from chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unban user: {str(e)}']}), 500

