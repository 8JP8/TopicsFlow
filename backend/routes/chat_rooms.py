from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.chat_room import ChatRoom
from models.message import Message
from models.anonymous_identity import AnonymousIdentity
from models.conversation_settings import ConversationSettings
from utils.validators import validate_message_content, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
from bson import ObjectId
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

        # Get picture and background picture if provided
        picture = data.get('picture')
        background_picture = data.get('background_picture')
        
        # Create conversation (chat room)
        chat_room_model = ChatRoom(current_app.db)
        room_id = chat_room_model.create_chat_room(
            topic_id=topic_id,
            name=name,
            description=description,
            owner_id=user_id,
            is_public=is_public,
            tags=tags,
            picture=picture,
            background_picture=background_picture
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
            # Automatically set user to following when they join
            try:
                from models.notification_settings import NotificationSettings
                notification_settings = NotificationSettings(current_app.db)
                notification_settings.follow_chat_room(user_id, room_id)
            except Exception as e:
                logger.warning(f"Failed to set follow status for user {user_id} on chatroom {room_id}: {str(e)}")
            
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
            # Convert all ObjectId fields to strings
            msg_id = str(message['_id'])
            message['_id'] = msg_id
            message['id'] = msg_id
            message['chat_room_id'] = str(message['chat_room_id'])
            message['user_id'] = str(message['user_id'])

            # Convert topic_id if present
            if 'topic_id' in message and message['topic_id'] is not None:
                if isinstance(message['topic_id'], ObjectId):
                    message['topic_id'] = str(message['topic_id'])

            # Get user details (or anonymous identity) - same as Message model
            if message.get('anonymous_identity'):
                message['display_name'] = message['anonymous_identity']
                message['is_anonymous'] = True
                message['sender_username'] = message['anonymous_identity']
                message['profile_picture'] = None
                message['is_admin'] = False
                message['is_owner'] = False
                message['is_moderator'] = False
            else:
                from models.user import User
                user_model = User(current_app.db)
                user = user_model.get_user_by_id(message['user_id'])
                if user:
                    message['display_name'] = user['username']
                    message['sender_username'] = user['username']
                    message['profile_picture'] = user.get('profile_picture')
                    message['is_admin'] = user.get('is_admin', False)
                    
                    # Check if owner or moderator
                    message['is_owner'] = False
                    message['is_moderator'] = False
                    if room:
                        message['is_owner'] = str(room.get('owner_id')) == str(message['user_id'])
                        moderators = room.get('moderators', [])
                        message['is_moderator'] = any(str(mod) == str(message['user_id']) for mod in moderators)
                else:
                    message['display_name'] = 'Deleted User'
                    message['sender_username'] = 'Deleted User'
                    message['profile_picture'] = None
                    message['is_admin'] = False
                    message['is_owner'] = False
                    message['is_moderator'] = False
                message['is_anonymous'] = False

            # Convert datetime to ISO string
            if 'created_at' in message and isinstance(message['created_at'], datetime):
                message['created_at'] = message['created_at'].isoformat()
            if 'updated_at' in message and isinstance(message['updated_at'], datetime):
                message['updated_at'] = message['updated_at'].isoformat()

            # Ensure can_delete is set
            if 'can_delete' not in message:
                message['can_delete'] = False
            
            # Convert any remaining ObjectId fields (mentions, reactions, etc.)
            if 'mentions' in message and isinstance(message['mentions'], list):
                message['mentions'] = [str(m) if isinstance(m, ObjectId) else m for m in message['mentions']]
            if 'reactions' in message and isinstance(message['reactions'], dict):
                for key in message['reactions']:
                    if isinstance(message['reactions'][key], list):
                        message['reactions'][key] = [str(r) if isinstance(r, ObjectId) else r for r in message['reactions'][key]]

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

        # Get attachments if provided
        attachments = data.get('attachments', [])
        
        # Log incoming attachments for debugging
        if attachments:
            logger.info(f"Received {len(attachments)} attachments")
            for i, att in enumerate(attachments):
                has_data = 'data' in att
                data_size = len(str(att.get('data', ''))) if has_data else 0
                logger.info(f"Attachment {i}: type={att.get('type')}, filename={att.get('filename')}, has_data={has_data}, data_size={data_size}")
        
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
                secret_key=secret_key
            )
            
            if errors:
                logger.warning(f"Errors processing attachments: {errors}")
            
            attachments = processed_attachments
            
            # Log processed attachments to verify base64 is removed
            for att in attachments:
                if 'data' in att:
                    logger.error(f"ERROR: Attachment still contains base64 data after processing! Type: {att.get('type')}, Filename: {att.get('filename')}")
                logger.debug(f"Processed attachment: {att.get('type')}, file_id: {att.get('file_id')}, url: {att.get('url')}")
        
        # Ensure no base64 data in attachments before creating message
        if attachments:
            for att in attachments:
                if 'data' in att:
                    logger.error(f"CRITICAL: Attachment has base64 data before message creation! Removing it.")
                    att.pop('data', None)
        
        # Create message
        message_model = Message(current_app.db)
        message_id = message_model.create_message(
            topic_id=topic_id,  # Add topic_id for compatibility
            chat_room_id=room_id,
            user_id=user_id,
            content=content,
            message_type=message_type,
            anonymous_identity=anonymous_identity,
            gif_url=gif_url,
            attachments=attachments
        )

        # Get created message
        new_message = message_model.get_message_by_id(message_id)
        if not new_message:
            return jsonify({'success': False, 'errors': ['Failed to create message']}), 500

        # get_message_by_id already converts ObjectIds, but we need to ensure ALL are converted
        from bson import ObjectId
        from datetime import datetime
        
        def convert_objectids(obj):
            """Recursively convert ObjectId to string in nested structures."""
            if isinstance(obj, ObjectId):
                return str(obj)
            elif isinstance(obj, dict):
                return {k: convert_objectids(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_objectids(item) for item in obj]
            elif isinstance(obj, datetime):
                return obj.isoformat()
            return obj
        
        # Add display info BEFORE final conversion
        if anonymous_identity:
            # For anonymous messages, explicitly set profile_picture to None
            new_message['profile_picture'] = None
            new_message['banner'] = None
        else:
            from models.user import User
            user_model = User(current_app.db)
            user = user_model.get_user_by_id(user_id)
            if user:
                new_message['profile_picture'] = user.get('profile_picture')
                new_message['banner'] = user.get('banner')
            else:
                new_message['profile_picture'] = None
                new_message['banner'] = None
        
        # Now recursively convert ALL remaining ObjectIds and datetimes
        new_message = convert_objectids(new_message)
        
        # Ensure can_delete is set (after conversion)
        new_message['can_delete'] = str(new_message.get('user_id')) == user_id

        # Don't expose real user_id when anonymous
        if anonymous_identity:
            new_message['user_id'] = ''  # Hide user_id for anonymous users
            new_message['is_anonymous'] = True

        # Process mentions in message content
        try:
            from utils.mention_parser import process_mentions_in_content
            room_name = room.get('name', 'Chat Room')
            process_mentions_in_content(
                db=current_app.db,
                content=content,
                content_id=message_id,
                content_type='chat_room_message',
                sender_id=user_id,
                context={
                    'chat_room_id': room_id,
                    'chat_room_name': room_name,
                    'topic_id': topic_id
                }
            )
            logger.info(f"Processed mentions in chatroom message {message_id}")
        except Exception as e:
            logger.warning(f"Failed to process mentions in chatroom message: {str(e)}")

        # Emit socket event
        try:
            socketio = current_app.extensions.get('socketio')
            if socketio:
                room_name = f"chat_room_{room_id}"
                socketio.emit('new_chat_room_message', new_message, room=room_name)
                logger.info(f"Emitted new_chat_room_message event to room {room_name} for message {message_id}")
        except Exception as e:
            logger.warning(f"Failed to emit socket event for message {message_id}: {str(e)}")

        # Notify chatroom members about new message (except sender)
        try:
            from models.notification_settings import NotificationSettings
            from models.notification import Notification
            
            notification_settings = NotificationSettings(current_app.db)
            notification_model = Notification(current_app.db)
            
            # Get all members of the chatroom (need to get fresh room data with ObjectIds)
            room_data = chat_room_model.collection.find_one({'_id': ObjectId(room_id)})
            members = [str(m) for m in room_data.get('members', [])] if room_data else []
            room_name = room.get('name', 'Chat Room')
            
            # Notify each member (except the sender)
            for member_id in members:
                if member_id == user_id:
                    continue  # Don't notify the sender
                
                # Check if topic is muted FIRST (topic silencing overrides everything)
                if topic_id and notification_settings.is_topic_muted(member_id, topic_id):
                    logger.info(f"Skipping notification for member {member_id} - topic {topic_id} is muted")
                    continue
                
                # Check if user is following the chatroom
                if not notification_settings.is_following_chat_room(member_id, room_id):
                    logger.info(f"Skipping notification for member {member_id} - chatroom {room_id} is not followed")
                    continue
                
                # Get sender username
                sender_username = new_message.get('display_name', 'Anonymous')
                if not sender_username or sender_username == 'Anonymous':
                    from models.user import User
                    user_model = User(current_app.db)
                    sender = user_model.get_user_by_id(user_id)
                    if sender:
                        sender_username = sender.get('username', 'Unknown')
                
                logger.info(f"Creating notification for member {member_id} about message in chatroom {room_id} from {sender_username}")
                
                # Create notification
                notification_id = notification_model.create_notification(
                    user_id=member_id,
                    notification_type='chatroom_message',
                    title='New message',
                    message=f'New message in "{room_name}"',
                    data={
                        'chat_room_id': room_id,
                        'chat_room_name': room_name,
                        'message_id': message_id,
                        'sender_id': user_id,
                        'sender_username': sender_username,
                        'topic_id': topic_id
                    },
                    sender_id=user_id,
                    context_id=room_id,
                    context_type='chat_room'
                )
                
                # Emit real-time notification via socket
                if notification_id:
                    try:
                        from app import socketio
                        if socketio:
                            user_room = f"user_{member_id}"
                            socketio.emit('new_notification', {
                                'id': notification_id,
                                'type': 'chatroom_message',
                                'title': 'New message',
                                'message': f'New message in "{room_name}"',
                                'data': {
                                    'chat_room_id': room_id,
                                    'chat_room_name': room_name,
                                    'message_id': message_id,
                                    'sender_username': sender_username
                                },
                                'sender_username': sender_username,
                                'context_id': room_id,
                                'context_type': 'chat_room',
                                'context_name': room_name,
                                'timestamp': new_message.get('created_at')
                            }, room=user_room)
                            logger.info(f"Emitted new_notification for chatroom message to user {member_id}")
                    except Exception as e:
                        logger.warning(f"Failed to emit notification socket event: {str(e)}")
        except Exception as e:
            logger.warning(f"Failed to notify chatroom members: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Message created successfully',
            'data': new_message
        }), 201

    except Exception as e:
        logger.error(f"Create chat room message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create message: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/messages/<message_id>', methods=['DELETE'])
@require_json
@require_auth()
@log_requests
def delete_chat_room_message(room_id, message_id):
    """Delete a message from a chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        data = request.get_json() or {}
        deletion_reason = data.get('deletion_reason')

        # Verify chat room exists
        chat_room_model = ChatRoom(current_app.db)
        room = chat_room_model.get_chat_room_by_id(room_id)
        if not room:
            return jsonify({'success': False, 'errors': ['Chat room not found']}), 404

        message_model = Message(current_app.db)
        message = message_model.get_message_by_id(message_id)
        
        if not message:
            return jsonify({'success': False, 'errors': ['Message not found']}), 404

        # Verify message belongs to this chat room
        if str(message.get('chat_room_id')) != room_id:
            return jsonify({'success': False, 'errors': ['Message does not belong to this chat room']}), 400

        # Check if user is owner (requires reason) or can delete without reason
        is_owner_deletion = False
        permission_level = chat_room_model.get_user_permission_level(room_id, user_id)
        is_owner_deletion = permission_level == 3 and str(message.get('user_id')) != user_id
        
        # If owner deleting someone else's message, require reason
        if is_owner_deletion and not deletion_reason:
            return jsonify({'success': False, 'errors': ['Deletion reason is required for owner deletions']}), 400

        success = message_model.delete_message(message_id, user_id, deletion_reason)

        if success:
            # If owner deleted with reason, create a report for admin
            if is_owner_deletion:
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
            
            # Emit socket event
            try:
                socketio = current_app.extensions.get('socketio')
                if socketio:
                    room_name = f"chat_room_{room_id}"
                    socketio.emit('message_deleted', {
                        'message_id': message_id,
                        'chat_room_id': room_id
                    }, room=room_name)
            except Exception as e:
                logger.warning(f"Failed to emit socket event for deleted message: {str(e)}")
            
            return jsonify({
                'success': True,
                'message': 'Message deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or message not found']}), 403

    except Exception as e:
        logger.error(f"Delete chat room message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to delete message']}), 500


@chat_rooms_bp.route('/<room_id>/members', methods=['GET'])
@require_auth()
@log_requests
def get_chat_room_members(room_id):
    """Get list of all members in a chat room"""
    try:
        from bson import ObjectId
        
        # Validate room_id
        if not room_id or len(room_id) != 24:
            return jsonify({'success': False, 'errors': ['Invalid room ID']}), 400
        
        chat_room_model = ChatRoom(current_app.db)
        room = chat_room_model.get_chat_room_by_id(room_id)
        if not room:
            return jsonify({'success': False, 'errors': ['Chat room not found']}), 404
        
        # Get members from the room's members list
        member_ids = room.get('members', [])
        if not member_ids:
            return jsonify({
                'success': True,
                'data': [],
                'count': 0
            }), 200
        
        # Get user details for all members
        from models.user import User
        user_model = User(current_app.db)
        members = []
        
        for member_id in member_ids:
            try:
                user = user_model.get_user_by_id(member_id)
                if user:
                    members.append({
                        'id': str(user['_id']),
                        'username': user.get('username', 'Unknown')
                    })
            except Exception as e:
                logger.warning(f"Failed to get user {member_id}: {str(e)}")
                continue
        
        # Sort by username
        members.sort(key=lambda x: x['username'].lower())
        
        return jsonify({
            'success': True,
            'data': members,
            'count': len(members)
        }), 200
        
    except Exception as e:
        logger.error(f"Get chat room members error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get members: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_chat_room(room_id):
    """Soft delete a chat room (only owner can delete). Requires admin approval."""
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
                'message': 'Chatroom deletion requested. It will be permanently deleted in 7 days pending admin approval.'
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


@chat_rooms_bp.route('/<room_id>/kick/<user_id>', methods=['POST'])
@require_auth()
@log_requests
def kick_user_from_chat(room_id, user_id):
    """Kick a user from a chat room (owner or moderator can kick)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        kicked_by = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.kick_user_from_chat(room_id, user_id, kicked_by)

        if success:
            return jsonify({
                'success': True,
                'message': 'User kicked from chat room successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied, cannot kick owner, or user not found']}), 403

    except Exception as e:
        logger.error(f"Kick user from chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to kick user: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/mute', methods=['POST'])
@require_json
@require_auth()
@log_requests
def mute_chat_room(room_id):
    """Mute a chat room for a specified duration."""
    try:
        data = request.get_json()
        minutes = int(data.get('minutes', 0))
        
        if minutes < -1:
            return jsonify({'success': False, 'errors': ['Invalid mute duration']}), 400
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']
        
        from models.notification_settings import NotificationSettings
        settings_model = NotificationSettings(current_app.db)
        success = settings_model.mute_chat_room(user_id, room_id, minutes)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Chat room muted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': ['Failed to mute chat room']
            }), 500
            
    except Exception as e:
        logger.error(f"Mute chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute chat room: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/unmute', methods=['POST'])
@require_auth()
@log_requests
def unmute_chat_room(room_id):
    """Unmute a chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']
        
        from models.notification_settings import NotificationSettings
        settings_model = NotificationSettings(current_app.db)
        success = settings_model.unmute_chat_room(user_id, room_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Chat room unmuted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': ['Failed to unmute chat room']
            }), 500
            
    except Exception as e:
        logger.error(f"Unmute chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unmute chat room: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/invite', methods=['POST'])
@require_auth()
@require_json
@log_requests
def invite_user_to_chat(room_id):
    """Invite a user to a private chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        data = request.get_json()
        invited_user_id = data.get('user_id')
        invited_username = data.get('username')

        if not invited_user_id and not invited_username:
            return jsonify({'success': False, 'errors': ['User ID or username is required']}), 400

        # If username provided, get user ID
        if invited_username and not invited_user_id:
            from models.user import User
            user_model = User(current_app.db)
            user = user_model.get_user_by_username(invited_username)
            if not user:
                return jsonify({'success': False, 'errors': ['User not found']}), 404
            invited_user_id = str(user['_id'])

        chat_room_model = ChatRoom(current_app.db)
        result = chat_room_model.invite_user(room_id, invited_user_id, user_id)

        if result == "is_owner":
            return jsonify({'success': False, 'errors': ['Cannot invite the owner of the chat room.']}), 400
        elif result == "already_member":
            return jsonify({'success': False, 'errors': ['User is already a member of this chat room.']}), 400
        elif result == "already_invited":
            return jsonify({'success': False, 'errors': ['User has already been invited to this chat room.']}), 400
        elif result == "is_banned":
            return jsonify({'success': False, 'errors': ['User is banned from this chat room.']}), 400
        elif result:  # result is invitation_id (string)
            # Get room and inviter details for WebSocket event
            room = chat_room_model.get_chat_room_by_id(room_id)
            from models.user import User
            user_model = User(current_app.db)
            inviter = user_model.get_user_by_id(user_id)
            
            # Emit WebSocket event for invitation
            socketio = current_app.extensions.get('socketio')
            if socketio:
                socketio.emit('chat_room_invitation', {
                    'invitation_id': result,  # result is the invitation_id
                    'room_id': room_id,
                    'invited_user_id': invited_user_id,
                    'invited_by': user_id,
                    'invited_by_username': inviter.get('username') if inviter else 'Unknown',
                    'room_name': room.get('name') if room else 'Unknown',
                    'room_description': room.get('description') if room else None
                }, room=f"user_{invited_user_id}")

            return jsonify({
                'success': True,
                'message': 'User invited successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to invite user. User may already be invited or you may not have permission.']}), 400

    except Exception as e:
        logger.error(f"Invite user to chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to invite user: {str(e)}']}), 500


@chat_rooms_bp.route('/invitations', methods=['GET'])
@require_auth()
@log_requests
def get_pending_invitations():
    """Get all pending invitations for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        invitations = chat_room_model.get_pending_invitations(user_id)

        return jsonify({
            'success': True,
            'data': invitations
        }), 200

    except Exception as e:
        logger.error(f"Get pending invitations error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get invitations: {str(e)}']}), 500


@chat_rooms_bp.route('/invitations/<invitation_id>/accept', methods=['POST'])
@require_auth()
@log_requests
def accept_invitation(invitation_id):
    """Accept a chat room invitation."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.accept_invitation(invitation_id, user_id)

        if success:
            # Emit WebSocket event
            socketio = current_app.extensions.get('socketio')
            if socketio:
                invitation = current_app.db.chat_room_invitations.find_one({'_id': ObjectId(invitation_id)})
                if invitation:
                    socketio.emit('chat_room_invitation_accepted', {
                        'room_id': str(invitation['room_id']),
                        'user_id': user_id
                    }, room=f"room_{invitation['room_id']}")

            return jsonify({
                'success': True,
                'message': 'Invitation accepted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to accept invitation']}), 400

    except Exception as e:
        logger.error(f"Accept invitation error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to accept invitation: {str(e)}']}), 500


@chat_rooms_bp.route('/invitations/<invitation_id>/decline', methods=['POST'])
@require_auth()
@log_requests
def decline_invitation(invitation_id):
    """Decline a chat room invitation."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.decline_invitation(invitation_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Invitation declined successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to decline invitation']}), 400

    except Exception as e:
        logger.error(f"Decline invitation error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to decline invitation: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/picture', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_chat_picture(room_id):
    """Update chat room picture (owner or moderator only)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        data = request.get_json()
        picture = data.get('picture')

        chat_room_model = ChatRoom(current_app.db)
        room = chat_room_model.get_chat_room_by_id(room_id)
        
        if not room:
            return jsonify({'success': False, 'errors': ['Chat room not found']}), 404

        # Check if user is owner or moderator
        permission_level = chat_room_model.get_user_permission_level(room_id, user_id)
        if permission_level < 2:  # Only owner (3) or moderator (2) can update
            return jsonify({'success': False, 'errors': ['Only the owner or moderator can update the picture']}), 403

        # Update picture
        result = chat_room_model.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$set': {'picture': picture}}
        )

        if result.modified_count > 0:
            updated_room = chat_room_model.get_chat_room_by_id(room_id)
            return jsonify({
                'success': True,
                'message': 'Picture updated successfully',
                'data': updated_room
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to update picture']}), 500

    except Exception as e:
        logger.error(f"Update chat picture error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to update picture: {str(e)}']}), 500


@chat_rooms_bp.route('/<room_id>/background', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_chat_background(room_id):
    """Update chat room background picture (owner or moderator only)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        data = request.get_json()
        background_picture = data.get('background_picture')
        
        # Darken the background image before storing
        if background_picture:
            from utils.image_compression import darken_image_base64
            darkened_image = darken_image_base64(background_picture, darkness_factor=0.6)
            if darkened_image:
                background_picture = darkened_image
                logger.info("Background image darkened before storage")

        chat_room_model = ChatRoom(current_app.db)
        room = chat_room_model.get_chat_room_by_id(room_id)
        
        if not room:
            return jsonify({'success': False, 'errors': ['Chat room not found']}), 404

        # Check if user is owner or moderator
        permission_level = chat_room_model.get_user_permission_level(room_id, user_id)
        if permission_level < 2:  # Only owner (3) or moderator (2) can update
            return jsonify({'success': False, 'errors': ['Only the owner or moderator can update the background picture']}), 403

        # Update background picture
        result = chat_room_model.collection.update_one(
            {'_id': ObjectId(room_id)},
            {'$set': {'background_picture': background_picture}}
        )

        if result.modified_count > 0:
            updated_room = chat_room_model.get_chat_room_by_id(room_id)
            return jsonify({
                'success': True,
                'message': 'Background picture updated successfully',
                'data': updated_room
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to update background picture']}), 500

    except Exception as e:
        logger.error(f"Update chat background error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to update background picture: {str(e)}']}), 500

