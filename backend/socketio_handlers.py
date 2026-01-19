from flask_socketio import emit, join_room, leave_room, disconnect
from flask import request, current_app
from services.auth_service import AuthService
from models.topic import Topic
from models.message import Message
from models.anonymous_identity import AnonymousIdentity
from models.private_message import PrivateMessage
from utils.validators import validate_message_content
from utils.content_filter import analyze_content_safety
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
import logging

logger = logging.getLogger(__name__)

# Store connected users (in production, use Redis)
connected_users = {}
user_rooms = {}  # Track which rooms each user is in
# Store last disconnect timestamps for offline users
user_last_disconnect = {}  # {user_id: datetime}


def register_socketio_handlers(socketio):
    """Register all SocketIO event handlers."""

    @socketio.on_error_default
    def default_error_handler(e):
        """Default error handler for SocketIO events."""
        logger.error(f"SocketIO error: {str(e)}", exc_info=True)
        return False

    @socketio.on('connect')
    def handle_connect():
        """Handle client connection."""
        try:
            # Get session ID first (may not be available in all contexts)
            # Get session ID first (may not be available in all contexts)
            try:
                sid = request.sid
                logger.info(f"[SOCKET CONNECT] New connection attempt: SID={sid}")
                
                # Check cookies/headers
                logger.info(f"[SOCKET CONNECT] Cookies: {request.cookies.keys()}")
            except (RuntimeError, AttributeError) as sid_error:
                logger.error(f"Could not get session ID during connect: {sid_error}")
                return False

            # Verify session
            try:
                auth_service = AuthService(current_app.db)
                is_auth = auth_service.is_authenticated()
                logger.info(f"[SOCKET CONNECT] Auth Service check: {is_auth}")
                
                if not is_auth:
                    logger.warning(f"Unauthenticated connection attempt from {sid}")
                    # Log session usage for debugging
                    from flask import session
                    logger.info(f"[SOCKET CONNECT] Flask Session content keys: {list(session.keys()) if session else 'None'}")
                    return False

                current_user_result = auth_service.get_current_user()
                logger.info(f"[SOCKET CONNECT] Get current user success: {current_user_result.get('success')}")
                
                if not current_user_result or not current_user_result.get('success'):
                    logger.warning(f"Invalid session for connection {sid}")
                    return False

                user = current_user_result.get('user')
                if not user:
                    logger.warning(f"No user data for connection {sid}")
                    return False

                user_id = user.get('id')
                logger.info(f"[SOCKET CONNECT] Authenticated User ID: {user_id}")
                
                if not user_id:
                    logger.warning(f"No user ID for connection {sid}")
                    return False

                username = user.get('username', 'Unknown')
            except Exception as auth_error:
                logger.error(f"Authentication error during connect: {auth_error}", exc_info=True)
                return False

            # Store user connection - ALWAYS use string keys for consistency
            try:
                user_id_str = str(user_id)
                connected_users[user_id_str] = {
                    'sid': sid,
                    'username': username,
                    'connected_at': datetime.utcnow(),
                    'is_online': True
                }
                # Remove from disconnect tracking when user reconnects
                if user_id_str in user_last_disconnect:
                    del user_last_disconnect[user_id_str]
            except Exception as store_error:
                logger.error(f"Error storing user connection: {store_error}", exc_info=True)
                return False
            
            # Join user's personal room for private messages
            try:
                user_room = f"user_{user_id}"
                join_room(user_room)
                logger.info(f"User {username} ({user_id}) joined their personal room: {user_room}")
            except Exception as room_error:
                logger.error(f"Error joining user room: {room_error}", exc_info=True)
                # Don't fail connection if room join fails, but log it

            logger.info(f"User {username} ({user_id}) connected successfully")

            # Emit events - wrap each in try/except to prevent one failure from breaking others
            try:
                emit('connected', {
                    'user_id': user_id,
                    'username': username,
                    'message': 'Successfully connected to chat server'
                })
            except Exception as emit_error:
                logger.error(f"Error emitting connected event: {emit_error}", exc_info=True)

            # Broadcast user online status to friends (if implemented)
            try:
                emit('user_online', {
                    'user_id': user_id,
                    'username': username
                }, broadcast=True, include_self=False)
            except Exception as emit_error:
                logger.error(f"Error emitting user_online event: {emit_error}", exc_info=True)

            # Broadcast updated online users count to all
            try:
                online_count = get_online_users_count()
                # Broadcast to others
                emit('online_count_update', {'count': online_count}, broadcast=True)
                # Send to self (the user who just connected)
                emit('online_count_update', {'count': online_count})
            except Exception as emit_error:
                logger.error(f"Error emitting online_count_update event: {emit_error}", exc_info=True)

            # Return True to accept the connection
            return True

        except Exception as e:
            logger.error(f"Unexpected connection error: {str(e)}", exc_info=True)
            # Return False to properly reject the connection on error
            return False

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection."""
        try:
            # Find user by session ID
            user_id = None
            username = None
            
            # Handle case where request.sid might not be available (server shutdown)
            try:
                sid = request.sid
            except (RuntimeError, AttributeError):
                logger.debug("No session ID available during disconnect")
                return
            
            # Use a copy of items to avoid modification during iteration
            for uid, user_data in list(connected_users.items()):
                if user_data.get('sid') == sid:
                    user_id = uid
                    username = user_data.get('username', 'Unknown')
                    break

            if user_id:
                # Store disconnect timestamp in database before removing from memory
                try:
                    from models.user import User
                    user_model = User(current_app.db)
                    user_model.update_last_online(user_id)
                    # Also keep in memory for quick access
                    user_last_disconnect[user_id] = datetime.utcnow()
                except Exception as db_error:
                    logger.warning(f"Failed to update last_online for user {user_id}: {db_error}")
                    # Still try to store in memory as fallback
                    try:
                        user_last_disconnect[user_id] = datetime.utcnow()
                    except Exception:
                        pass
                
                # Remove from connected users
                try:
                    if user_id in connected_users:
                        del connected_users[user_id]
                except (KeyError, RuntimeError):
                    pass  # Already removed or server shutting down

                # Remove from all topic rooms
                if user_id in user_rooms:
                    try:
                        for tracked_room in list(user_rooms[user_id]):
                            try:
                                # Backward compatibility: some code stores raw topic_id instead of room name
                                if isinstance(tracked_room, str) and not tracked_room.startswith(('topic_', 'chat_room_', 'post_', 'voip_', 'user_')):
                                    tracked_room = f"topic_{tracked_room}"

                                leave_room(tracked_room)

                                # Only emit user_left_topic for topic rooms
                                if isinstance(tracked_room, str) and tracked_room.startswith('topic_'):
                                    topic_id = tracked_room.split('topic_', 1)[1]
                                    try:
                                        emit('user_left_topic', {
                                            'user_id': user_id,
                                            'username': username,
                                            'topic_id': topic_id
                                        }, room=tracked_room, skip_sid=sid)
                                    except (RuntimeError, AttributeError):
                                        logger.debug(f"Could not emit user_left_topic for room {tracked_room}")

                                # Handle VOIP disconnects
                                if isinstance(tracked_room, str) and tracked_room.startswith('voip_'):
                                    call_id = tracked_room.split('voip_', 1)[1]
                                    try:
                                        from models.voip import VoipCall
                                        voip_model = VoipCall(current_app.db)
                                        voip_model.set_disconnected_status(call_id, user_id, True)

                                        # Broadcast disconnect status to room (skipping the disconnected user)
                                        emit('voip_user_disconnected', {
                                            'call_id': call_id,
                                            'user_id': user_id,
                                            'username': username,
                                            'is_disconnected': True
                                        }, room=tracked_room, skip_sid=sid)
                                    except Exception as e:
                                        logger.error(f"Failed to handle VOIP disconnect for call {call_id}: {e}")
                            except (RuntimeError, AttributeError) as room_error:
                                logger.debug(f"Could not leave room {tracked_room}: {room_error}")
                        del user_rooms[user_id]
                    except (KeyError, RuntimeError):
                        pass  # Already removed or server shutting down

                logger.info(f"User {username} ({user_id}) disconnected")

                # Broadcast user offline status (only if server is still running)
                try:
                    emit('user_offline', {
                        'user_id': user_id,
                        'username': username
                    }, broadcast=True, include_self=False, skip_sid=sid)

                    # Broadcast updated online users count to all
                    online_count = get_online_users_count()
                    emit('online_count_update', {'count': online_count}, broadcast=True, skip_sid=sid)
                except (RuntimeError, AttributeError):
                    # Server might be shutting down - this is okay
                    logger.debug("Could not broadcast user_offline - server may be shutting down")
            else:
                logger.debug(f"Disconnect event for unknown session: {sid}")

        except (RuntimeError, AttributeError) as e:
            # These errors are common during server shutdown and are harmless
            logger.debug(f"Disconnect error (non-critical, likely server shutdown): {str(e)}")
        except Exception as e:
            # Log other errors but don't crash
            logger.warning(f"Disconnect error: {str(e)}")

    @socketio.on('join_topic')
    def handle_join_topic(data):
        """Handle user joining a topic."""
        try:
            topic_id = data.get('topic_id')
            use_anonymous = data.get('use_anonymous', False)
            custom_anonymous_name = data.get('custom_anonymous_name')

            logger.info(f"Join topic request: topic_id={topic_id}, data={data}")

            if not topic_id:
                logger.error(f"Join topic error: topic_id is missing. Data received: {data}")
                emit('error', {'message': 'Topic ID is required'})
                return

            # Ensure topic_id is a string
            topic_id = str(topic_id)

            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Verify topic exists and user has access
            topic_model = Topic(current_app.db)
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
                anon_model = AnonymousIdentity(current_app.db)
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
            message_model = Message(current_app.db)
            messages = message_model.get_messages(topic_id, limit=50, user_id=user_id)

            # Get topic info
            permission_level = topic_model.get_user_permission_level(topic_id, user_id)

            # Ensure topic_id is a string for consistency
            topic_id_str = str(topic_id)
            
            emit('topic_joined', {
                'topic_id': topic_id_str,  # Always send as string
                'topic_title': topic['title'],
                'topic_description': topic.get('description', ''),
                'anonymous_name': anonymous_name,
                'permission_level': permission_level,
                'messages': messages,
                'member_count': topic['member_count'],
                'tags': topic.get('tags', []),
                'settings': topic.get('settings', {})
            })
            
            logger.info(f"Emitted topic_joined for topic_id: {topic_id_str} (type: {type(topic_id_str).__name__})")

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
            auth_service = AuthService(current_app.db)
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
            anon_model = AnonymousIdentity(current_app.db)
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

            logger.info(f"Send message request: topic_id={topic_id}, content_length={len(content) if content else 0}, data={data}")

            if not topic_id:
                logger.error(f"Send message error: topic_id is missing. Data received: {data}")
                emit('error', {'message': 'Topic ID is required'})
                return

            # Ensure topic_id is a string and validate it's a valid ObjectId
            topic_id = str(topic_id).strip()
            
            # Validate ObjectId format (24 hex characters)
            try:
                # Try to create ObjectId to validate format
                validated_topic_id = ObjectId(topic_id)
                topic_id = str(validated_topic_id)  # Use the validated version
                logger.info(f"Validated topic_id: {topic_id}")
            except (InvalidId, ValueError, TypeError) as e:
                logger.error(f"Invalid topic_id format: {topic_id}. Error: {str(e)}")
                emit('error', {'message': f'Invalid topic ID format: {topic_id}'})
                return

            if not content and not gif_url:
                logger.error(f"Send message error: content is empty and no gif_url. Data received: {data}")
                emit('error', {'message': 'Message content or GIF URL is required'})
                return

            # Verify user is authenticated and in topic
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Check if user is in the topic room - if not, try to auto-join
            if user_id not in user_rooms or topic_id not in user_rooms[user_id]:
                logger.warning(f"User {user_id} not in topic room {topic_id}, attempting to join automatically")
                # Try to join the topic automatically
                try:
                    room_name = f"topic_{topic_id}"
                    join_room(room_name)
                    if user_id not in user_rooms:
                        user_rooms[user_id] = set()
                    user_rooms[user_id].add(topic_id)
                    logger.info(f"Auto-joined user {user_id} to topic {topic_id}")
                except Exception as e:
                    logger.error(f"Failed to auto-join topic: {str(e)}")
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
            topic_model = Topic(current_app.db)
            try:
                topic = topic_model.get_topic_by_id(topic_id)
            except (InvalidId, ValueError, TypeError) as e:
                logger.error(f"Invalid topic_id when querying database: {topic_id}. Error: {str(e)}")
                emit('error', {'message': f'Invalid topic ID: {topic_id}'})
                return

            if not topic:
                logger.error(f"Topic not found in database: {topic_id}")
                emit('error', {'message': 'Topic not found'})
                return
            
            logger.info(f"Topic found: {topic.get('title', 'Unknown')} (ID: {topic_id})")

            # Check if user is banned from topic
            if topic_model.is_user_banned_from_topic(topic_id, user_id):
                emit('error', {'message': 'You are banned from this topic'})
                return

            # Handle anonymous identity
            anonymous_name = None
            if use_anonymous and topic.get('settings', {}).get('allow_anonymous', True):
                anon_model = AnonymousIdentity(current_app.db)
                anonymous_name = anon_model.get_anonymous_identity(user_id, topic_id)
                # If identity doesn't exist, create it
                if not anonymous_name:
                    logger.info(f"[MESSAGE_SEND] Creating new anonymous identity for user {user_id} in topic {topic_id}")
                    anonymous_name = anon_model.create_anonymous_identity(user_id, topic_id)
                    logger.info(f"[MESSAGE_SEND] Created anonymous identity: {anonymous_name}")

            # Create message
            message_model = Message(current_app.db)
            try:
                logger.info(f"[MESSAGE_SEND] Step 1: Creating message in database")
                logger.info(f"[MESSAGE_SEND]   - topic_id: {topic_id} (type: {type(topic_id).__name__})")
                logger.info(f"[MESSAGE_SEND]   - user_id: {user_id} (type: {type(user_id).__name__})")
                logger.info(f"[MESSAGE_SEND]   - content_length: {len(content)}")
                logger.info(f"[MESSAGE_SEND]   - message_type: {message_type}")
                logger.info(f"[MESSAGE_SEND]   - use_anonymous: {use_anonymous}, anonymous_name: {anonymous_name}")
                
                message_id = message_model.create_message(
                    topic_id=topic_id,
                    user_id=user_id,
                    content=content,
                    message_type=message_type,
                    anonymous_identity=anonymous_name,
                    gif_url=gif_url
                )
                
                logger.info(f"[MESSAGE_SEND] Step 2: Message created successfully")
                logger.info(f"[MESSAGE_SEND]   - message_id: {message_id}")
                
                # Verify message exists in database
                db_message = message_model.collection.find_one({'_id': ObjectId(message_id)})
                if db_message:
                    logger.info(f"[MESSAGE_SEND] Step 3: Database verification successful")
                    logger.info(f"[MESSAGE_SEND]   - Message found in DB with content: {db_message.get('content', '')[:50]}...")
                else:
                    logger.error(f"[MESSAGE_SEND] Step 3: Database verification FAILED - message not found!")
                    
            except Exception as e:
                logger.error(f"[MESSAGE_SEND] FAILED to create message: {str(e)}", exc_info=True)
                import traceback
                logger.error(f"[MESSAGE_SEND] Traceback: {traceback.format_exc()}")
                emit('error', {'message': f'Failed to create message: {str(e)}'})
                return

            # Get the created message
            logger.info(f"[MESSAGE_SEND] Step 4: Retrieving created message")
            new_message = message_model.get_message_by_id(message_id)
            if not new_message:
                logger.error(f"[MESSAGE_SEND] Step 4 FAILED: Message created but could not be retrieved: {message_id}")
                emit('error', {'message': 'Failed to retrieve created message'})
                return
            
            logger.info(f"[MESSAGE_SEND] Step 4: Message retrieved successfully")
            logger.info(f"[MESSAGE_SEND]   - message_id: {new_message.get('_id')}")
            logger.info(f"[MESSAGE_SEND]   - topic_id: {new_message.get('topic_id')}")
            logger.info(f"[MESSAGE_SEND]   - content: {new_message.get('content', '')[:50]}...")

            # Process mentions
            logger.info(f"[MESSAGE_SEND] Step 4.5: Processing mentions")
            from utils.helpers import extract_mentions
            from models.anonymous_identity import AnonymousIdentity
            from models.user import User
            from bson import ObjectId
            
            mentioned_texts = extract_mentions(content)
            mentioned_user_ids = []
            
            if mentioned_texts:
                logger.info(f"[MESSAGE_SEND] Found {len(mentioned_texts)} mentions: {mentioned_texts}")
                
                # Get all topic members
                topic_members = topic.get('members', [])
                user_model = User(current_app.db)
                anon_model = AnonymousIdentity(current_app.db)
                
                # Get all anonymous identities in this topic
                topic_anonymous = anon_model.get_topic_anonymous_users(topic_id)
                anonymous_map = {anon['anonymous_name'].lower(): anon['user_id'] for anon in topic_anonymous}
                
                for mention_text in mentioned_texts:
                    mention_lower = mention_text.lower()
                    found_user_id = None
                    
                    # Check if it matches a username (case-insensitive)
                    for member_id in topic_members:
                        member = user_model.get_user_by_id(member_id)
                        if member and member.get('username', '').lower() == mention_lower:
                            found_user_id = member_id
                            logger.info(f"[MESSAGE_SEND] Mention '{mention_text}' matched username: {member.get('username')}")
                            break
                    
                    # If not found, check anonymous identities (case-insensitive)
                    if not found_user_id and mention_lower in anonymous_map:
                        found_user_id = anonymous_map[mention_lower]
                        logger.info(f"[MESSAGE_SEND] Mention '{mention_text}' matched anonymous name")
                    
                    if found_user_id:
                        mentioned_user_id_str = str(found_user_id)
                        
                        # Check if topic is muted for this user
                        from models.notification_settings import NotificationSettings
                        notification_settings = NotificationSettings(current_app.db)
                        if notification_settings.is_topic_muted(mentioned_user_id_str, topic_id):
                            logger.info(f"[MESSAGE_SEND] Skipping mention notification for user {mentioned_user_id_str} - topic {topic_id} is muted")
                            mentioned_user_ids.append(mentioned_user_id_str) # Still track the mention
                            continue

                        mentioned_user_ids.append(mentioned_user_id_str)
                        # Emit mention notification to user's personal room
                        user_room = f"user_{found_user_id}"
                        mention_data = {
                            'topic_id': topic_id,
                            'topic_title': topic.get('title', 'Unknown Topic'),
                            'message_id': message_id,
                            'mentioned_by': user.get('username', 'Unknown'),
                            'mentioned_by_id': user_id,
                            'mentioned_name': mention_text,
                            'content_preview': content[:100] + ('...' if len(content) > 100 else ''),
                            'created_at': new_message.get('created_at', ''),
                        }
                        try:
                            emit('user_mentioned', mention_data, room=user_room)
                            logger.info(f"[MESSAGE_SEND] Sent mention notification to user {found_user_id} in room {user_room}")
                        except Exception as e:
                            logger.error(f"[MESSAGE_SEND] Failed to send mention notification: {str(e)}")
                    else:
                        logger.info(f"[MESSAGE_SEND] Mention '{mention_text}' did not match any user in topic")
                
                # Update message with mentions
                if mentioned_user_ids:
                    message_model.collection.update_one(
                        {'_id': ObjectId(message_id)},
                        {'$set': {'mentions': [ObjectId(uid) for uid in mentioned_user_ids]}}
                    )
                    logger.info(f"[MESSAGE_SEND] Updated message with {len(mentioned_user_ids)} mentions")

            # Prepare message for broadcast - convert ObjectIds to strings
            logger.info(f"[MESSAGE_SEND] Step 5: Preparing broadcast message")
            
            # Ensure created_at is a string (should already be ISO format from get_message_by_id)
            created_at_str = new_message.get('created_at', '')
            if isinstance(created_at_str, datetime):
                created_at_str = created_at_str.isoformat()
            elif not isinstance(created_at_str, str):
                created_at_str = str(created_at_str)
            
            # Don't expose real user_id when anonymous
            is_anonymous = bool(anonymous_name)
            broadcast_message = {
                'id': str(new_message.get('id') or new_message.get('_id', '')),
                'topic_id': str(new_message.get('topic_id', '')),
                'user_id': '' if is_anonymous else str(new_message.get('user_id', '')),  # Hide user_id for anonymous
                'content': new_message.get('content', ''),
                'message_type': new_message.get('message_type', 'text'),
                'gif_url': new_message.get('gif_url'),
                'created_at': created_at_str,
                'display_name': anonymous_name if anonymous_name else user.get('username', 'Unknown'),
                'is_anonymous': is_anonymous,
                'can_delete': new_message.get('can_delete', False)
            }

            logger.info(f"[MESSAGE_SEND] Step 5: Broadcast message prepared")
            logger.info(f"[MESSAGE_SEND]   - message_id: {broadcast_message['id']}")
            logger.info(f"[MESSAGE_SEND]   - topic_id: {broadcast_message['topic_id']}")
            logger.info(f"[MESSAGE_SEND]   - display_name: {broadcast_message['display_name']}")

            # Broadcast to topic room
            room_name = f"topic_{topic_id}"
            logger.info(f"[MESSAGE_SEND] Step 6: Broadcasting to room '{room_name}'")
            logger.info(f"[MESSAGE_SEND]   - Room members: {len(user_rooms.get(user_id, set()))} topics for user")
            
            try:
                emit('new_message', broadcast_message, room=room_name)
                logger.info(f"[MESSAGE_SEND] Step 6: Successfully emitted to room '{room_name}'")
            except Exception as e:
                logger.error(f"[MESSAGE_SEND] Step 6 FAILED: Error emitting to room: {str(e)}")

            # Also send to sender directly to ensure they see their message
            logger.info(f"[MESSAGE_SEND] Step 7: Sending confirmation to sender")
            try:
                emit('new_message', broadcast_message)
                logger.info(f"[MESSAGE_SEND] Step 7: Successfully sent to sender")
            except Exception as e:
                logger.error(f"[MESSAGE_SEND] Step 7 FAILED: Error sending to sender: {str(e)}")

            # Confirm to sender
            logger.info(f"[MESSAGE_SEND] Step 8: Sending message_sent confirmation")
            try:
                emit('message_sent', {'message_id': message_id})
                logger.info(f"[MESSAGE_SEND] Step 8: Successfully sent confirmation")
            except Exception as e:
                logger.error(f"[MESSAGE_SEND] Step 8 FAILED: Error sending confirmation: {str(e)}")

            logger.info(f"[MESSAGE_SEND] COMPLETE: Message sent in topic {topic_id} by {user['username']}, message_id: {message_id}")

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
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return

            user = current_user_result['user']
            user_id = user['id']

            # Check if user is in topic
            if user_id not in user_rooms or topic_id not in user_rooms[user_id]:
                return

            # Get anonymous identity
            anon_model = AnonymousIdentity(current_app.db)
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
            auth_service = AuthService(current_app.db)
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

            logger.info(f"[PRIVATE_MSG] Send request: to_user_id={to_user_id}, content_length={len(content) if content else 0}, message_type={message_type}")

            if not to_user_id:
                logger.error(f"[PRIVATE_MSG] Missing recipient")
                emit('error', {'message': 'Recipient is required'})
                return

            # For GIF messages, content can be empty if gif_url is provided
            if message_type == 'gif' and gif_url:
                # Allow empty content for GIF messages
                if not content:
                    content = ''  # Ensure it's an empty string
            else:
                # For non-GIF messages, content is required
                if not content:
                    logger.error(f"[PRIVATE_MSG] Missing content")
                    emit('error', {'message': 'Message content is required'})
                    return

            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                logger.error(f"[PRIVATE_MSG] Authentication failed")
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']
            
            logger.info(f"[PRIVATE_MSG] User authenticated: {user['username']} ({user_id})")

            # Validate message content (skip validation for GIF messages with empty content)
            if message_type != 'gif' or content:
                validation_result = validate_message_content(content)
                if not validation_result['valid']:
                    logger.error(f"[PRIVATE_MSG] Content validation failed: {validation_result['errors']}")
                    emit('error', {'message': ' '.join(validation_result['errors'])})
                    return

            # Check if this is a self-message
            is_self_message = (str(to_user_id) == str(user_id))
            logger.info(f"[PRIVATE_MSG] Is self-message: {is_self_message}")

            # Create private message
            pm_model = PrivateMessage(current_app.db)
            logger.info(f"[PRIVATE_MSG] Creating message in database")
            message_id = pm_model.send_message(
                from_user_id=user_id,
                to_user_id=to_user_id,
                content=content,
                message_type=message_type,
                gif_url=gif_url
            )
            logger.info(f"[PRIVATE_MSG] Message created: {message_id}")

            # Get the created message
            new_message = pm_model.get_message_by_id(message_id)
            if not new_message:
                logger.error(f"[PRIVATE_MSG] Message created but could not be retrieved: {message_id}")
                emit('error', {'message': 'Failed to send message'})
                return

            # Convert datetime to ISO string if needed
            from bson import ObjectId
            created_at = new_message['created_at']
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat()

            # Prepare message for both sender and receiver
            broadcast_message = {
                'id': str(new_message['_id']),
                'from_user_id': str(new_message['from_user_id']),
                'to_user_id': str(new_message['to_user_id']),
                'content': new_message['content'],
                'message_type': new_message['message_type'],
                'gif_url': new_message.get('gif_url'),
                'created_at': created_at,
                'is_from_me': True,
                'sender_username': user['username'],
                'notification_type': 'private_message',
                'preview': content[:50] + ('...' if len(content) > 50 else '')
            }

            # Send to sender (they should see their own message)
            sender_room = f"user_{user_id}"
            logger.info(f"[PRIVATE_MSG] Sending confirmation to sender in room {sender_room}")
            try:
                emit('private_message_sent', broadcast_message, room=sender_room)
                logger.info(f"[PRIVATE_MSG] Successfully sent to sender")
            except Exception as e:
                logger.error(f"[PRIVATE_MSG] Failed to send to sender: {str(e)}")

            # Create notification for recipient (if not muted and not self-message)
            if not is_self_message:
                try:
                    from models.notification_settings import NotificationSettings
                    from models.notification import Notification
                    
                    notification_settings = NotificationSettings(current_app.db)
                    notification_model = Notification(current_app.db)
                    
                    # Check if private messages from this user are muted for the recipient
                    if not notification_settings.is_private_message_muted(to_user_id, user_id):
                        # Create preview of message
                        preview = content[:50] + ('...' if len(content) > 50 else '')
                        if message_type == 'gif' and gif_url:
                            preview = '[GIF]'
                        
                        # Create notification
                        notification_id = notification_model.create_notification(
                            user_id=to_user_id,
                            notification_type='message',
                            title='New message',
                            message=f'New message from {user["username"]}',
                            data={
                                'from_user_id': user_id,
                                'from_username': user['username'],
                                'message_id': message_id,
                                'preview': preview
                            },
                            sender_id=user_id,
                            context_id=to_user_id,
                            context_type='private_message'
                        )
                        
                        # Emit real-time notification via socket
                        if notification_id:
                            try:
                                receiver_room = f"user_{to_user_id}"
                                socketio.emit('new_notification', {
                                    'id': notification_id,
                                    'type': 'message',
                                    'title': 'New message',
                                    'message': f'New message from {user["username"]}',
                                    'data': {
                                        'from_user_id': user_id,
                                        'from_username': user['username'],
                                        'message_id': message_id,
                                        'preview': preview
                                    },
                                    'sender_username': user['username'],
                                    'timestamp': created_at
                                }, room=receiver_room)
                                logger.info(f"[PRIVATE_MSG] Notification created and emitted for user {to_user_id}")
                            except Exception as e:
                                logger.warning(f"[PRIVATE_MSG] Failed to emit notification socket event: {str(e)}")
                except Exception as e:
                    logger.warning(f"[PRIVATE_MSG] Failed to create notification: {str(e)}")

            # Handle self-message: emit as received message too
            if is_self_message:
                logger.info(f"[PRIVATE_MSG] Self-message detected, emitting as received message")
                receiver_message = broadcast_message.copy()
                receiver_message['is_from_me'] = False
                try:
                    emit('new_private_message', receiver_message, room=sender_room)
                    logger.info(f"[PRIVATE_MSG] Self-message sent as received message")
                except Exception as e:
                    logger.error(f"[PRIVATE_MSG] Failed to send self-message as received: {str(e)}")
            else:
                # Send to receiver - try SID first for reliable delivery, fallback to room
                receiver_message = broadcast_message.copy()
                receiver_message['is_from_me'] = False
                
                # Check if user is connected and get their SID
                receiver_sid = None
                to_user_id_str = str(to_user_id)  # Ensure string for consistent lookup
                if to_user_id_str in connected_users:
                    receiver_sid = connected_users[to_user_id_str].get('sid')
                
                if receiver_sid:
                    logger.info(f"[PRIVATE_MSG] Sending to receiver via SID: {receiver_sid}")
                    try:
                        socketio.emit('new_private_message', receiver_message, to=receiver_sid)
                        logger.info(f"[PRIVATE_MSG] Successfully emitted to receiver SID")
                    except Exception as e:
                        logger.error(f"[PRIVATE_MSG] Failed to send to receiver SID: {str(e)}")
                else:
                    # Fallback to room emission
                    receiver_room = f"user_{to_user_id}"
                    logger.info(f"[PRIVATE_MSG] Receiver not in connected_users, trying room: {receiver_room}")
                    try:
                        socketio.emit('new_private_message', receiver_message, room=receiver_room)
                        logger.info(f"[PRIVATE_MSG] Successfully emitted to receiver room")
                    except Exception as e:
                        logger.error(f"[PRIVATE_MSG] Failed to send to receiver room: {str(e)}")

            # Confirm to sender
            try:
                emit('private_message_confirmed', {'message_id': message_id})
                logger.info(f"[PRIVATE_MSG] Confirmation sent")
            except Exception as e:
                logger.error(f"[PRIVATE_MSG] Failed to send confirmation: {str(e)}")

            logger.info(f"[PRIVATE_MSG] COMPLETE: Message sent from {user['username']} to user {to_user_id}")

        except Exception as e:
            logger.error(f"[PRIVATE_MSG] ERROR: {str(e)}", exc_info=True)
            emit('error', {'message': 'Failed to send private message'})

    @socketio.on('mark_messages_read')
    def handle_mark_messages_read(data):
        """Handle marking private messages as read."""
        try:
            from_user_id = data.get('from_user_id')

            if not from_user_id:
                return

            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return

            user = current_user_result['user']
            user_id = user['id']

            # Mark conversation as read
            pm_model = PrivateMessage(current_app.db)
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
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Update anonymous identity
            anon_model = AnonymousIdentity(current_app.db)
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


    # ========== NEW HANDLERS FOR THEMES, POSTS, COMMENTS, CHAT ROOMS ==========
    
    @socketio.on('join_topic')
    def handle_join_topic(data):
        """Handle user joining a topic room."""
        try:
            topic_id = data.get('topic_id')

            if not topic_id:
                emit('error', {'message': 'Topic ID is required'})
                return

            topic_id = str(topic_id)

            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return

            user = current_user_result['user']
            user_id = user['id']

            # Verify topic exists
            topic_model = Topic(current_app.db)
            topic = topic_model.get_topic_by_id(topic_id)

            if not topic:
                emit('error', {'message': 'Topic not found'})
                return

            # Check if user is banned
            if topic_model.is_user_banned_from_topic(topic_id, user_id):
                emit('error', {'message': 'You are banned from this topic'})
                return

            # Join room
            room_name = f"topic_{topic_id}"
            join_room(room_name)

            # Track user's rooms
            if user_id not in user_rooms:
                user_rooms[user_id] = set()
            user_rooms[user_id].add(f"topic_{topic_id}")

            emit('topic_joined', {
                'topic_id': topic_id,
                'topic_title': topic['title']
            })

            logger.info(f"User {user['username']} joined topic {topic_id}")

        except Exception as e:
            logger.error(f"Join topic error: {str(e)}", exc_info=True)
            emit('error', {'message': 'Failed to join topic'})
    
    @socketio.on('join_chat_room')
    def handle_join_chat_room(data):
        """Handle user joining a chat room."""
        try:
            room_id = data.get('room_id')
            
            if not room_id:
                emit('error', {'message': 'Chat room ID is required'})
                return
            
            room_id = str(room_id)
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Verify chat room exists
            from models.chat_room import ChatRoom
            chat_room_model = ChatRoom(current_app.db)
            room = chat_room_model.get_chat_room_by_id(room_id)
            
            if not room:
                emit('error', {'message': 'Chat room not found'})
                return
            
            # Join room
            room_name = f"chat_room_{room_id}"
            join_room(room_name)
            
            # Track user's rooms
            if user_id not in user_rooms:
                user_rooms[user_id] = set()
            user_rooms[user_id].add(room_name)
            
            emit('chat_room_joined', {
                'room_id': room_id,
                'room_name': room['name']
            })
            
            logger.info(f"User {user['username']} joined chat room {room_id}")
            
        except Exception as e:
            logger.error(f"Join chat room error: {str(e)}", exc_info=True)
            emit('error', {'message': 'Failed to join chat room'})

    @socketio.on('leave_chat_room')
    def handle_leave_chat_room(data):
        """Handle user leaving a chat room."""
        try:
            room_id = data.get('room_id')
            if not room_id:
                return
            room_id = str(room_id)

            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result.get('success'):
                return
            user = current_user_result['user']
            user_id = user['id']

            room_name = f"chat_room_{room_id}"
            leave_room(room_name)

            if user_id in user_rooms:
                try:
                    user_rooms[user_id].discard(room_name)
                except Exception:
                    pass

            emit('chat_room_left', {'room_id': room_id})
            logger.info(f"User {user.get('username', 'Unknown')} left chat room {room_id}")
        except Exception as e:
            logger.error(f"Leave chat room error: {str(e)}", exc_info=True)
    
    @socketio.on('join_post')
    def handle_join_post(data):
        """Handle user joining a post room (for real-time comment updates)."""
        try:
            post_id = data.get('post_id')
            
            if not post_id:
                emit('error', {'message': 'Post ID is required'})
                return
            
            post_id = str(post_id)
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('error', {'message': 'Authentication required'})
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Verify post exists
            from models.post import Post
            post_model = Post(current_app.db)
            post = post_model.get_post_by_id(post_id)
            
            if not post:
                emit('error', {'message': 'Post not found'})
                return
            
            # Join room
            room_name = f"post_{post_id}"
            join_room(room_name)
            
            # Track user's rooms
            if user_id not in user_rooms:
                user_rooms[user_id] = set()
            user_rooms[user_id].add(f"post_{post_id}")
            
            emit('post_joined', {
                'post_id': post_id,
                'post_title': post.get('title', '')
            })
            
            logger.info(f"User {user['username']} joined post {post_id}")
            
        except Exception as e:
            logger.error(f"Join post error: {str(e)}", exc_info=True)
            emit('error', {'message': 'Failed to join post'})
    
    # Note: The actual events (new_post, post_upvoted, new_comment, comment_upvoted, 
    # new_chat_room_message, user_mentioned) are emitted from the routes/models,
    # not handled here. These are one-way broadcasts from server to clients.
    
    @socketio.on('get_admin_count')
    def handle_get_admin_count():
        """Handle request for online admin count."""
        try:
            admin_count = get_online_admin_count()
            emit('admin_online_count', {'count': admin_count})
            logger.info(f"Sent admin online count: {admin_count}")
        except Exception as e:
            logger.error(f"Error getting admin count: {e}")
            emit('admin_online_count', {'count': 0})

    @socketio.on('debug_whoami')
    def handle_debug_whoami():
        """Debug handler to verify user identity and rooms."""
        try:
            sid = request.sid
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            
            user_data = "Anonymous/Not Authenticated"
            user_id = "None"
            
            if current_user_result['success']:
                user = current_user_result['user']
                user_id = user['id']
                user_data = f"{user['username']} ({user_id})"
            
            # Get rooms for this SID
            # Note: flask_socketio doesn't expose rooms(sid) easily in all versions, 
            # but we can try accessing the room manager or just what we tracked.
            
            tracked_rooms = list(user_rooms.get(user_id, set())) if user_id != "None" else []
            
            response = {
                'sid': sid,
                'user': user_data,
                'user_id': user_id,
                'tracked_rooms_in_memory': tracked_rooms,
                'expected_private_room': f"user_{user_id}" if user_id != "None" else "N/A"
            }
            
            logger.info(f"[DEBUG_WHOAMI] {response}")
            emit('debug_whoami_response', response)
            
        except Exception as e:
            logger.error(f"Debug whoami error: {e}")
            emit('error', {'message': f'Debug error: {str(e)}'})

    # ==================== VOIP HANDLERS ====================
    
    @socketio.on('voip_create_call')
    def handle_voip_create_call(data):
        """Create a new VOIP call for a chat room or DM."""
        try:
            room_id = data.get('room_id')
            room_type = data.get('room_type', 'group')  # 'group' or 'dm'
            room_name = data.get('room_name', '')
            
            if not room_id:
                emit('voip_error', {'message': 'Room ID is required'})
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('voip_error', {'message': 'Authentication required'})
                return
            
            user = current_user_result['user']
            user_id = user['id']
            username = user.get('username', 'Unknown')
            
            # Create the call
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            
            call = voip_model.create_call(room_id, room_type, user_id, room_name)
            
            if not call:
                # Call already exists, return the existing call
                existing_call = voip_model.get_active_call(room_id)
                if existing_call:
                    emit('voip_call_exists', {
                        'call': existing_call,
                        'message': 'A call is already active for this room'
                    })
                else:
                    emit('voip_error', {'message': 'Failed to create call'})
                return
            
            # Join the VOIP room for signaling
            voip_room = f"voip_{call['id']}"
            join_room(voip_room)
            
            logger.info(f"[VOIP] User {username} created call {call['id']} for room {room_id}")
            
            # Emit call created to the creator
            emit('voip_call_created', {
                'call': call,
                'user': {
                    'id': user_id,
                    'username': username,
                    'profile_picture': user.get('profile_picture')
                }
            })
            
            # Notify other users in the chat room about the new call
            if room_type == 'group':
                chat_room = f"chat_room_{room_id}"
                emit('voip_call_started', {
                    'call': call,
                    'started_by': {
                        'id': user_id,
                        'username': username,
                        'profile_picture': user.get('profile_picture')
                    }
                }, room=chat_room, include_self=False)
            else:
                # For DM, notify the other user
                target_user_id = room_id
                if room_type == 'dm' and '_' in room_id:
                    # If room_id is composite (userA_userB), find the ID that is not current user
                    parts = room_id.split('_')
                    # Find the part that is NOT the current user_id
                    for part in parts:
                        if part != user_id:
                            target_user_id = part
                            break
                            
                other_user_room = f"user_{target_user_id}"
                emit('voip_incoming_call', {
                    'call': call,
                    'caller': {
                        'id': user_id,
                        'username': username,
                        'profile_picture': user.get('profile_picture')
                    }
                }, room=other_user_room)
            
        except Exception as e:
            logger.error(f"[VOIP] Create call error: {str(e)}")
            emit('voip_error', {'message': 'Failed to create call'})

    @socketio.on('voip_join_call')
    def handle_voip_join_call(data):
        """Join an existing VOIP call."""
        try:
            call_id = data.get('call_id')
            
            if not call_id:
                emit('voip_error', {'message': 'Call ID is required'})
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('voip_error', {'message': 'Authentication required'})
                return
            
            user = current_user_result['user']
            user_id = user['id']
            username = user.get('username', 'Unknown')
            
            # Join the call
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            
            call = voip_model.join_call(call_id, user_id)
            
            if not call:
                emit('voip_error', {'message': 'Call not found or already ended'})
                return
            
            # Join the VOIP room for signaling
            voip_room = f"voip_{call_id}"
            join_room(voip_room)
            
            logger.info(f"[VOIP] User {username} joined call {call_id}")
            
            # Emit to the user who joined
            emit('voip_call_joined', {
                'call': call,
                'user': {
                    'id': user_id,
                    'username': username,
                    'profile_picture': user.get('profile_picture')
                }
            })
            
            # Notify other participants
            emit('voip_user_joined', {
                'call_id': call_id,
                'user': {
                    'id': user_id,
                    'username': username,
                    'profile_picture': user.get('profile_picture')
                }
            }, room=voip_room, include_self=False)
            
        except Exception as e:
            logger.error(f"[VOIP] Join call error: {str(e)}")
            emit('voip_error', {'message': 'Failed to join call'})

    @socketio.on('voip_leave_call')
    def handle_voip_leave_call(data):
        """Leave a VOIP call."""
        try:
            call_id = data.get('call_id')
            
            if not call_id:
                emit('voip_error', {'message': 'Call ID is required'})
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            username = user.get('username', 'Unknown')
            
            # Leave the call
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            
            result = voip_model.leave_call(call_id, user_id)
            
            voip_room = f"voip_{call_id}"
            
            # Notify other participants
            if result:
                if result.get('ended'):
                    # Call ended (no participants left)
                    emit('voip_call_ended', {
                        'call_id': call_id,
                        'reason': 'no_participants'
                    }, room=voip_room)
                    logger.info(f"[VOIP] Call {call_id} ended - no participants remaining")
                else:
                    # User left but call continues
                    emit('voip_user_left', {
                        'call_id': call_id,
                        'user': {
                            'id': user_id,
                            'username': username
                        }
                    }, room=voip_room, include_self=False)
            
            # Leave the VOIP room
            leave_room(voip_room)
            
            # Confirm to the user
            emit('voip_left_call', {'call_id': call_id})
            
            logger.info(f"[VOIP] User {username} left call {call_id}")
            
        except Exception as e:
            logger.error(f"[VOIP] Leave call error: {str(e)}")
            emit('voip_error', {'message': 'Failed to leave call'})

    @socketio.on('voip_ice_candidate')
    def handle_voip_ice_candidate(data):
        """Relay ICE candidate to a specific peer."""
        try:
            call_id = data.get('call_id')
            target_user_id = data.get('target_user_id')
            candidate = data.get('candidate')
            
            if not all([call_id, target_user_id, candidate]):
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Send ICE candidate to target user
            target_room = f"user_{target_user_id}"
            emit('voip_ice_candidate', {
                'call_id': call_id,
                'from_user_id': user_id,
                'candidate': candidate
            }, room=target_room)
            
        except Exception as e:
            logger.error(f"[VOIP] ICE candidate error: {str(e)}")

    @socketio.on('voip_offer')
    def handle_voip_offer(data):
        """Relay SDP offer to a specific peer."""
        try:
            call_id = data.get('call_id')
            target_user_id = data.get('target_user_id')
            offer = data.get('offer')
            
            if not all([call_id, target_user_id, offer]):
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            username = user.get('username', 'Unknown')
            
            # Send offer to target user
            target_room = f"user_{target_user_id}"
            emit('voip_offer', {
                'call_id': call_id,
                'from_user_id': user_id,
                'from_username': username,
                'offer': offer
            }, room=target_room)
            
            logger.info(f"[VOIP] Relayed offer from {user_id} to {target_user_id}")
            
        except Exception as e:
            logger.error(f"[VOIP] Offer relay error: {str(e)}")

    @socketio.on('voip_answer')
    def handle_voip_answer(data):
        """Relay SDP answer to a specific peer."""
        try:
            call_id = data.get('call_id')
            target_user_id = data.get('target_user_id')
            answer = data.get('answer')
            
            if not all([call_id, target_user_id, answer]):
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Send answer to target user
            target_room = f"user_{target_user_id}"
            emit('voip_answer', {
                'call_id': call_id,
                'from_user_id': user_id,
                'answer': answer
            }, room=target_room)
            
            logger.info(f"[VOIP] Relayed answer from {user_id} to {target_user_id}")
            
        except Exception as e:
            logger.error(f"[VOIP] Answer relay error: {str(e)}")

    @socketio.on('voip_speaking')
    def handle_voip_speaking(data):
        """Broadcast speaking status to call participants."""
        try:
            call_id = data.get('call_id')
            is_speaking = data.get('is_speaking', False)
            
            if not call_id:
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Broadcast speaking status to all participants
            voip_room = f"voip_{call_id}"
            emit('voip_speaking_status', {
                'call_id': call_id,
                'user_id': user_id,
                'is_speaking': is_speaking
            }, room=voip_room, include_self=False)
            
        except Exception as e:
            logger.error(f"[VOIP] Speaking status error: {str(e)}")

    @socketio.on('voip_mute_toggle')
    def handle_voip_mute_toggle(data):
        """Toggle and broadcast mute status."""
        try:
            call_id = data.get('call_id')
            is_muted = data.get('is_muted', False)
            
            if not call_id:
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Update mute status in database
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            voip_model.set_mute_status(call_id, user_id, is_muted)
            
            # Broadcast mute status to all participants
            voip_room = f"voip_{call_id}"
            emit('voip_mute_status', {
                'call_id': call_id,
                'user_id': user_id,
                'is_muted': is_muted
            }, room=voip_room)
            
        except Exception as e:
            logger.error(f"[VOIP] Mute toggle error: {str(e)}")

    @socketio.on('voip_get_active_call')
    def handle_voip_get_active_call(data):
        """Get active call info for a room."""
        try:
            room_id = data.get('room_id')
            
            if not room_id:
                emit('voip_active_call', {'call': None})
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('voip_error', {'message': 'Authentication required'})
                return
            
            # Get active call
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            call = voip_model.get_active_call(room_id)
            
            emit('voip_active_call', {
                'room_id': room_id,
                'call': call
            })
            
        except Exception as e:
            logger.error(f"[VOIP] Get active call error: {str(e)}")
            emit('voip_active_call', {'call': None})

    @socketio.on('voip_heartbeat')
    def handle_voip_heartbeat(data):
        """Update heartbeat for a participant in a call."""
        try:
            call_id = data.get('call_id')
            
            if not call_id:
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Update heartbeat
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            voip_model.update_heartbeat(call_id, user_id)
            
        except Exception as e:
            logger.error(f"[VOIP] Heartbeat error: {str(e)}")

    @socketio.on('voip_get_my_call')
    def handle_voip_get_my_call():
        """Get the user's current active call for reconnection after page refresh."""
        try:
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                emit('voip_my_call', {'call': None})
                return
            
            user = current_user_result['user']
            user_id = user['id']
            
            # Get user's active call
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            call = voip_model.get_user_active_call(user_id)
            
            if call:
                # Rejoin the voip room for signaling
                voip_room = f"voip_{call['id']}"
                join_room(voip_room)
                logger.info(f"[VOIP] User {user.get('username')} reconnected to call {call['id']}")
            
            emit('voip_my_call', {'call': call})
            
        except Exception as e:
            logger.error(f"[VOIP] Get my call error: {str(e)}")
            emit('voip_my_call', {'call': None})

    @socketio.on('voip_set_disconnected')
    def handle_voip_set_disconnected(data):
        """Mark a user as disconnected in a call (for network issues)."""
        try:
            call_id = data.get('call_id')
            is_disconnected = data.get('is_disconnected', True)
            
            if not call_id:
                return
            
            # Verify user is authenticated
            auth_service = AuthService(current_app.db)
            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                return
            
            user = current_user_result['user']
            user_id = user['id']
            username = user.get('username', 'Unknown')
            
            # Update disconnected status
            from models.voip import VoipCall
            voip_model = VoipCall(current_app.db)
            voip_model.set_disconnected_status(call_id, user_id, is_disconnected)
            
            # Broadcast to other participants
            voip_room = f"voip_{call_id}"
            emit('voip_user_disconnected', {
                'call_id': call_id,
                'user_id': user_id,
                'username': username,
                'is_disconnected': is_disconnected
            }, room=voip_room, include_self=False)
            
            logger.info(f"[VOIP] User {username} disconnected status: {is_disconnected}")
            
        except Exception as e:
            logger.error(f"[VOIP] Set disconnected error: {str(e)}")

def get_online_users_count() -> int:
    """Get count of currently online users."""
    return len([u for u in connected_users.values() if u.get('is_online', False)])


def get_online_admin_count() -> int:
    """Get count of currently online admins."""
    from flask import current_app
    from models.user import User
    
    try:
        user_model = User(current_app.db)
        count = 0
        for user_id in connected_users:
            user = user_model.get_user_by_id(user_id)
            if user and user.get('is_admin', False):
                count += 1
        return count
    except Exception as e:
        logger.error(f"Error getting online admin count: {e}")
        return 0


def get_user_room_count(user_id: str) -> int:
    """Get number of rooms a user is currently in."""
    return len(user_rooms.get(user_id, set()))


def cleanup_disconnected_users():
    """Clean up disconnected users from the tracking."""
    global connected_users, user_rooms

    # Remove users who have been disconnected for more than 5 minutes
    current_time = datetime.utcnow()
    disconnected_users = []
    for user_id, user_data in connected_users.items():
        connected_at = user_data.get('connected_at')
        if connected_at:
            time_diff = (current_time - connected_at).total_seconds()
            if time_diff > 300:  # 5 minutes
                disconnected_users.append(user_id)

    for user_id in disconnected_users:
        del connected_users[user_id]
        if user_id in user_rooms:
            del user_rooms[user_id]


def emit_admin_notification(socketio_instance, notification_type, data):
    """Emit notification to all connected admins"""
    try:
        from models.user import User
        from flask import current_app
        
        # Get all admin users
        admins = list(current_app.db.users.find({'is_admin': True}, {'_id': 1}))
        
        # Emit to each admin's personal room
        for admin in admins:
            admin_id = str(admin['_id'])
            room_name = f"user_{admin_id}"
            socketio_instance.emit('admin_notification', {
                'type': notification_type,
                'data': data,
                'timestamp': datetime.utcnow().isoformat()
            }, room=room_name)
            logger.info(f"Emitted admin notification to {room_name}: {notification_type}")
    except Exception as e:
        logger.error(f"Failed to emit admin notification: {str(e)}")