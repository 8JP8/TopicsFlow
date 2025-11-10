from flask_socketio import emit, join_room, leave_room, disconnect
from flask import request
from services.auth_service import AuthService
from models.topic import Topic
from models.message import Message
from models.anonymous_identity import AnonymousIdentity
from models.private_message import PrivateMessage
from utils.validators import validate_message_content
from utils.content_filter import analyze_content_safety
import logging

logger = logging.getLogger(__name__)

# Store connected users (in production, use Redis)
connected_users = {}
user_rooms = {}  # Track which rooms each user is in


def register_socketio_handlers(socketio):
    """Register all SocketIO event handlers."""

    @socketio.on('connect')
    def handle_connect():
        """Handle client connection."""
        try:
            # Verify session
            auth_service = AuthService(request.current_app.db)
            if not auth_service.is_authenticated():
                logger.warning(f"Unauthenticated connection attempt from {request.sid}")
                disconnect()
                return

            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                logger.warning(f"Invalid session for connection {request.sid}")
                disconnect()
                return

            user = current_user_result['user']
            user_id = user['id']

            # Store user connection
            connected_users[user_id] = {
                'sid': request.sid,
                'username': user['username'],
                'connected_at': request.start_time,
                'is_online': True
            }

            # Join user to their personal room for private messages
            join_room(f"user_{user_id}")

            logger.info(f"User {user['username']} ({user_id}) connected")

            emit('connected', {
                'user_id': user_id,
                'username': user['username'],
                'message': 'Successfully connected to chat server'
            })

            # Broadcast user online status to friends (if implemented)
            emit('user_online', {
                'user_id': user_id,
                'username': user['username']
            }, broadcast=True, include_self=False)

        except Exception as e:
            logger.error(f"Connection error: {str(e)}")
            disconnect()

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection."""
        try:
            # Find user by session ID
            user_id = None
            for uid, user_data in connected_users.items():
                if user_data['sid'] == request.sid:
                    user_id = uid
                    break

            if user_id:
                username = connected_users[user_id]['username']
                del connected_users[user_id]

                # Remove from all topic rooms
                if user_id in user_rooms:
                    for room_id in user_rooms[user_id].copy():
                        leave_room(f"topic_{room_id}")
                        emit('user_left_topic', {
                            'user_id': user_id,
                            'username': username,
                            'topic_id': room_id
                        }, room=f"topic_{room_id}")
                    del user_rooms[user_id]

                logger.info(f"User {username} ({user_id}) disconnected")

                # Broadcast user offline status
                emit('user_offline', {
                    'user_id': user_id,
                    'username': username
                }, broadcast=True, include_self=False)

        except Exception as e:
            logger.error(f"Disconnection error: {str(e)}")

    @socketio.on('join_topic')
    def handle_join_topic(data):
        """Handle user joining a topic."""
        try:
            topic_id = data.get('topic_id')
            use_anonymous = data.get('use_anonymous', False)
            custom_anonymous_name = data.get('custom_anonymous_name')

            if not topic_id:
                emit('error', {'message': 'Topic ID is required'})
                return

            # Verify user is authenticated
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Verify topic exists and user has access
            topic_model = Topic(request.current_app.db)
            topic = topic_model.get_topic_by_id(topic_id)

            if not topic:
                emit('error', {'message': 'Topic not found'})
                return

            # Check if user is banned from topic
            if topic_model.is_user_banned_from_topic(topic_id, user_id):
                emit('error', {'message': 'You are banned from this topic'})
                return

            # Add user as member if not already
            topic_model.add_member(topic_id, user_id)

            # Join room
            room_name = f"topic_{topic_id}"
            join_room(room_name)

            # Track user's rooms
            if user_id not in user_rooms:
                user_rooms[user_id] = set()
            user_rooms[user_id].add(topic_id)

            # Handle anonymous identity
            anonymous_name = None
            if use_anonymous and topic.get('settings', {}).get('allow_anonymous', True):
                anon_model = AnonymousIdentity(request.current_app.db)
                if custom_anonymous_name:
                    # Validate and use custom anonymous name
                    anonymous_name = anon_model.create_anonymous_identity(
                        user_id, topic_id, custom_anonymous_name
                    )
                else:
                    # Get existing or create new anonymous identity
                    anonymous_name = anon_model.get_anonymous_identity(user_id, topic_id)
                    if not anonymous_name:
                        anonymous_name = anon_model.create_anonymous_identity(user_id, topic_id)

            # Get recent messages
            message_model = Message(request.current_app.db)
            messages = message_model.get_messages(topic_id, limit=50, user_id=user_id)

            # Get topic info
            permission_level = topic_model.get_user_permission_level(topic_id, user_id)

            emit('topic_joined', {
                'topic_id': topic_id,
                'topic_title': topic['title'],
                'topic_description': topic.get('description', ''),
                'anonymous_name': anonymous_name,
                'permission_level': permission_level,
                'messages': messages,
                'member_count': topic['member_count'],
                'tags': topic.get('tags', []),
                'settings': topic.get('settings', {})
            })

            # Notify other users in topic
            display_name = anonymous_name if anonymous_name else user['username']
            emit('user_joined_topic', {
                'user_id': user_id,
                'username': user['username'],
                'display_name': display_name,
                'is_anonymous': bool(anonymous_name),
                'topic_id': topic_id
            }, room=room_name, include_self=False)

            logger.info(f"User {user['username']} joined topic {topic_id}")

        except Exception as e:
            logger.error(f"Join topic error: {str(e)}")
            emit('error', {'message': 'Failed to join topic'})

    @socketio.on('leave_topic')
    def handle_leave_topic(data):
        """Handle user leaving a topic."""
        try:
            topic_id = data.get('topic_id')

            if not topic_id:
                emit('error', {'message': 'Topic ID is required'})
                return

            # Verify user is authenticated
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return

            user = current_user_result['user']
            user_id = user['id']

            # Leave room
            room_name = f"topic_{topic_id}"
            leave_room(room_name)

            # Update user's room tracking
            if user_id in user_rooms:
                user_rooms[user_id].discard(topic_id)
                if not user_rooms[user_id]:
                    del user_rooms[user_id]

            # Get anonymous identity for notification
            anon_model = AnonymousIdentity(request.current_app.db)
            anonymous_name = anon_model.get_anonymous_identity(user_id, topic_id)

            # Notify other users
            display_name = anonymous_name if anonymous_name else user['username']
            emit('user_left_topic', {
                'user_id': user_id,
                'username': user['username'],
                'display_name': display_name,
                'is_anonymous': bool(anonymous_name),
                'topic_id': topic_id
            }, room=room_name, include_self=False)

            emit('topic_left', {'topic_id': topic_id})

            logger.info(f"User {user['username']} left topic {topic_id}")

        except Exception as e:
            logger.error(f"Leave topic error: {str(e)}")
            emit('error', {'message': 'Failed to leave topic'})

    @socketio.on('send_message')
    def handle_send_message(data):
        """Handle sending a message to a topic."""
        try:
            topic_id = data.get('topic_id')
            content = data.get('content', '').strip()
            message_type = data.get('message_type', 'text')
            use_anonymous = data.get('use_anonymous', False)
            gif_url = data.get('gif_url')

            if not topic_id or not content:
                emit('error', {'message': 'Topic ID and content are required'})
                return

            # Verify user is authenticated and in topic
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Check if user is in the topic room
            if user_id not in user_rooms or topic_id not in user_rooms[user_id]:
                emit('error', {'message': 'You must join the topic first'})
                return

            # Validate message content
            validation_result = validate_message_content(content)
            if not validation_result['valid']:
                emit('error', {'message': ' '.join(validation_result['errors'])})
                return

            # Check for safety issues
            safety_analysis = analyze_content_safety(content)
            if safety_analysis['severity'] == 'critical':
                emit('error', {'message': 'Message contains inappropriate content'})
                return

            # Verify topic exists and user has access
            topic_model = Topic(request.current_app.db)
            topic = topic_model.get_topic_by_id(topic_id)

            if not topic:
                emit('error', {'message': 'Topic not found'})
                return

            # Check if user is banned from topic
            if topic_model.is_user_banned_from_topic(topic_id, user_id):
                emit('error', {'message': 'You are banned from this topic'})
                return

            # Handle anonymous identity
            anonymous_name = None
            if use_anonymous and topic.get('settings', {}).get('allow_anonymous', True):
                anon_model = AnonymousIdentity(request.current_app.db)
                anonymous_name = anon_model.get_anonymous_identity(user_id, topic_id)

            # Create message
            message_model = Message(request.current_app.db)
            message_id = message_model.create_message(
                topic_id=topic_id,
                user_id=user_id,
                content=content,
                message_type=message_type,
                anonymous_identity=anonymous_name,
                gif_url=gif_url
            )

            # Get the created message
            new_message = message_model.get_message_by_id(message_id)
            if not new_message:
                emit('error', {'message': 'Failed to send message'})
                return

            # Prepare message for broadcast
            broadcast_message = {
                'id': new_message['_id'],
                'topic_id': new_message['topic_id'],
                'user_id': new_message['user_id'],
                'content': new_message['content'],
                'message_type': new_message['message_type'],
                'gif_url': new_message.get('gif_url'),
                'created_at': new_message['created_at'],
                'display_name': anonymous_name if anonymous_name else user['username'],
                'is_anonymous': bool(anonymous_name),
                'can_delete': new_message.get('can_delete', False)
            }

            # Broadcast to topic room
            room_name = f"topic_{topic_id}"
            emit('new_message', broadcast_message, room=room_name)

            # Confirm to sender
            emit('message_sent', {'message_id': message_id})

            logger.info(f"Message sent in topic {topic_id} by {user['username']}")

        except Exception as e:
            logger.error(f"Send message error: {str(e)}")
            emit('error', {'message': 'Failed to send message'})

    @socketio.on('typing_start')
    def handle_typing_start(data):
        """Handle user starting to type."""
        try:
            topic_id = data.get('topic_id')

            if not topic_id:
                return

            # Verify user is authenticated
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return

            user = current_user_result['user']
            user_id = user['id']

            # Check if user is in topic
            if user_id not in user_rooms or topic_id not in user_rooms[user_id]:
                return

            # Get anonymous identity
            anon_model = AnonymousIdentity(request.current_app.db)
            anonymous_name = anon_model.get_anonymous_identity(user_id, topic_id)

            display_name = anonymous_name if anonymous_name else user['username']

            # Broadcast typing indicator
            room_name = f"topic_{topic_id}"
            emit('user_typing', {
                'user_id': user_id,
                'display_name': display_name,
                'is_anonymous': bool(anonymous_name)
            }, room=room_name, include_self=False)

        except Exception as e:
            logger.error(f"Typing start error: {str(e)}")

    @socketio.on('typing_stop')
    def handle_typing_stop(data):
        """Handle user stopping typing."""
        try:
            topic_id = data.get('topic_id')

            if not topic_id:
                return

            # Verify user is authenticated
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return

            user = current_user_result['user']
            user_id = user['id']

            # Broadcast typing stop
            room_name = f"topic_{topic_id}"
            emit('user_stop_typing', {
                'user_id': user_id
            }, room=room_name, include_self=False)

        except Exception as e:
            logger.error(f"Typing stop error: {str(e)}")

    @socketio.on('send_private_message')
    def handle_send_private_message(data):
        """Handle sending a private message."""
        try:
            to_user_id = data.get('to_user_id')
            content = data.get('content', '').strip()
            message_type = data.get('message_type', 'text')
            gif_url = data.get('gif_url')

            if not to_user_id or not content:
                emit('error', {'message': 'Recipient and content are required'})
                return

            # Verify user is authenticated
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Validate message content
            validation_result = validate_message_content(content)
            if not validation_result['valid']:
                emit('error', {'message': ' '.join(validation_result['errors'])})
                return

            # Create private message
            pm_model = PrivateMessage(request.current_app.db)
            message_id = pm_model.send_message(
                from_user_id=user_id,
                to_user_id=to_user_id,
                content=content,
                message_type=message_type,
                gif_url=gif_url
            )

            # Get the created message
            new_message = pm_model.get_message_by_id(message_id)
            if not new_message:
                emit('error', {'message': 'Failed to send message'})
                return

            # Prepare message for both sender and receiver
            broadcast_message = {
                'id': new_message['_id'],
                'from_user_id': new_message['from_user_id'],
                'to_user_id': new_message['to_user_id'],
                'content': new_message['content'],
                'message_type': new_message['message_type'],
                'gif_url': new_message.get('gif_url'),
                'created_at': new_message['created_at'],
                'is_from_me': True,
                'sender_username': user['username']
            }

            # Send to sender
            emit('private_message_sent', broadcast_message)

            # Send to receiver if they're online
            if to_user_id in connected_users:
                receiver_message = broadcast_message.copy()
                receiver_message['is_from_me'] = False
                receiver_room = f"user_{to_user_id}"
                emit('new_private_message', receiver_message, room=receiver_room)

            # Confirm to sender
            emit('private_message_confirmed', {'message_id': message_id})

            logger.info(f"Private message sent from {user['username']} to user {to_user_id}")

        except Exception as e:
            logger.error(f"Private message error: {str(e)}")
            emit('error', {'message': 'Failed to send private message'})

    @socketio.on('mark_messages_read')
    def handle_mark_messages_read(data):
        """Handle marking private messages as read."""
        try:
            from_user_id = data.get('from_user_id')

            if not from_user_id:
                return

            # Verify user is authenticated
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return

            user = current_user_result['user']
            user_id = user['id']

            # Mark conversation as read
            pm_model = PrivateMessage(request.current_app.db)
            pm_model.mark_conversation_as_read(user_id, from_user_id)

            emit('messages_marked_read', {'from_user_id': from_user_id})

        except Exception as e:
            logger.error(f"Mark messages read error: {str(e)}")

    @socketio.on('update_anonymous_name')
    def handle_update_anonymous_name(data):
        """Handle updating anonymous name for a topic."""
        try:
            topic_id = data.get('topic_id')
            new_name = data.get('new_name', '').strip()

            if not topic_id or not new_name:
                emit('error', {'message': 'Topic ID and new name are required'})
                return

            # Verify user is authenticated
            auth_service = AuthService(request.current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Update anonymous identity
            anon_model = AnonymousIdentity(request.current_app.db)
            success = anon_model.update_anonymous_identity(user_id, topic_id, new_name)

            if success:
                emit('anonymous_name_updated', {
                    'topic_id': topic_id,
                    'anonymous_name': new_name
                })

                # Notify topic members about the name change
                room_name = f"topic_{topic_id}"
                emit('user_anonymous_name_changed', {
                    'user_id': user_id,
                    'new_anonymous_name': new_name,
                    'topic_id': topic_id
                }, room=room_name, include_self=False)
            else:
                emit('error', {'message': 'Failed to update anonymous name'})

        except Exception as e:
            logger.error(f"Update anonymous name error: {str(e)}")
            emit('error', {'message': 'Failed to update anonymous name'})

    @socketio.on('get_online_users')
    def handle_get_online_users():
        """Handle getting list of online users."""
        try:
            online_users = []
            for user_id, user_data in connected_users.items():
                if user_data.get('is_online', False):
                    online_users.append({
                        'user_id': user_id,
                        'username': user_data['username'],
                        'connected_at': user_data['connected_at'].isoformat()
                    })

            emit('online_users_list', {'users': online_users})

        except Exception as e:
            logger.error(f"Get online users error: {str(e)}")
            emit('error', {'message': 'Failed to get online users'})


def get_online_users_count() -> int:
    """Get count of currently online users."""
    return len([u for u in connected_users.values() if u.get('is_online', False)])


def get_user_room_count(user_id: str) -> int:
    """Get number of rooms a user is currently in."""
    return len(user_rooms.get(user_id, set()))


def cleanup_disconnected_users():
    """Clean up disconnected users from the tracking."""
    global connected_users, user_rooms

    # Remove users who have been disconnected for more than 5 minutes
    current_time = request.start_time if request else None
    if current_time:
        disconnected_users = []
        for user_id, user_data in connected_users.items():
            time_diff = (current_time - user_data['connected_at']).total_seconds()
            if time_diff > 300:  # 5 minutes
                disconnected_users.append(user_id)

        for user_id in disconnected_users:
            del connected_users[user_id]
            if user_id in user_rooms:
                del user_rooms[user_id]