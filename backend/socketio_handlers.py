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


def register_socketio_handlers(socketio):
    """Register all SocketIO event handlers."""

    @socketio.on('connect')
    def handle_connect():
        """Handle client connection."""
        try:
            # Verify session
            auth_service = AuthService(current_app.db)
            if not auth_service.is_authenticated():
                logger.warning(f"Unauthenticated connection attempt from {request.sid}")
                # Don't disconnect here - let the connection fail naturally
                # Returning without emitting will cause the connection to be rejected
                return

            current_user_result = auth_service.get_current_user()
            if not current_user_result['success']:
                logger.warning(f"Invalid session for connection {request.sid}")
                # Don't disconnect here - let the connection fail naturally
                return

            user = current_user_result['user']
            user_id = user['id']

            # Store user connection
            connected_users[user_id] = {
                'sid': request.sid,
                'username': user['username'],
                'connected_at': datetime.utcnow(),
                'is_online': True
            }
            
            # Join user's personal room for private messages
            user_room = f"user_{user_id}"
            join_room(user_room)
            logger.info(f"User {user['username']} ({user_id}) joined their personal room: {user_room}")

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
            logger.error(f"Connection error: {str(e)}", exc_info=True)
            # Don't try to disconnect on error - just log it
            # The connection will fail naturally

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
                # Remove from connected users
                try:
                    if user_id in connected_users:
                        del connected_users[user_id]
                except (KeyError, RuntimeError):
                    pass  # Already removed or server shutting down

                # Remove from all topic rooms
                if user_id in user_rooms:
                    try:
                        for room_id in list(user_rooms[user_id]):
                            try:
                                leave_room(f"topic_{room_id}")
                                # Only emit if we have a valid socket context
                                try:
                                    emit('user_left_topic', {
                                        'user_id': user_id,
                                        'username': username,
                                        'topic_id': room_id
                                    }, room=f"topic_{room_id}", skip_sid=sid)
                                except (RuntimeError, AttributeError):
                                    # Server might be shutting down
                                    logger.debug(f"Could not emit user_left_topic for room {room_id}")
                            except (RuntimeError, AttributeError) as room_error:
                                logger.debug(f"Could not leave room {room_id}: {room_error}")
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
                        mentioned_user_ids.append(str(found_user_id))
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
            
            broadcast_message = {
                'id': str(new_message.get('id') or new_message.get('_id', '')),
                'topic_id': str(new_message.get('topic_id', '')),
                'user_id': str(new_message.get('user_id', '')),
                'content': new_message.get('content', ''),
                'message_type': new_message.get('message_type', 'text'),
                'gif_url': new_message.get('gif_url'),
                'created_at': created_at_str,
                'display_name': anonymous_name if anonymous_name else user.get('username', 'Unknown'),
                'is_anonymous': bool(anonymous_name),
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

            logger.info(f"[PRIVATE_MSG] Send request: to_user_id={to_user_id}, content_length={len(content) if content else 0}")

            if not to_user_id or not content:
                logger.error(f"[PRIVATE_MSG] Missing recipient or content")
                emit('error', {'message': 'Recipient and content are required'})
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

            # Validate message content
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
                # Send to receiver if they're online
                if to_user_id in connected_users:
                    receiver_message = broadcast_message.copy()
                    receiver_message['is_from_me'] = False
                    receiver_room = f"user_{to_user_id}"
                    logger.info(f"[PRIVATE_MSG] Sending to receiver in room {receiver_room}")
                    try:
                        emit('new_private_message', receiver_message, room=receiver_room)
                        logger.info(f"[PRIVATE_MSG] Successfully sent to receiver")
                    except Exception as e:
                        logger.error(f"[PRIVATE_MSG] Failed to send to receiver: {str(e)}")
                else:
                    logger.info(f"[PRIVATE_MSG] Receiver {to_user_id} not online, message saved but not delivered via socket")

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