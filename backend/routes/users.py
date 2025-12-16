from flask import Blueprint, request, jsonify, current_app, session
from bson import ObjectId
from datetime import datetime
from services.auth_service import AuthService
from models.user import User
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from models.private_message import PrivateMessage
from models.conversation_settings import ConversationSettings
from models.friend import Friend
from utils.decorators import require_auth, require_json, log_requests
from utils.image_compression import compress_image_base64
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
    """Update current user's profile (username, profile picture, banner, country)."""
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
        banner = data.get('banner')
        country_code = data.get('country_code')

        if not username and not profile_picture and banner is None and country_code is None:
            return jsonify({'success': False, 'errors': ['Username, profile picture, banner, or country required']}), 400

        user_model = User(current_app.db)
        update_data = {}

        if username:
            # Check if username is available
            existing_user = user_model.get_user_by_username(username)
            if existing_user and str(existing_user['_id']) != user_id:
                return jsonify({'success': False, 'errors': ['Username already taken']}), 400
            update_data['username'] = username

        # Handle country_code update
        if country_code is not None:
            if country_code == '' or country_code is None:
                update_data['country_code'] = None
            elif len(country_code) == 2:
                update_data['country_code'] = country_code.upper()
            else:
                return jsonify({'success': False, 'errors': ['Invalid country code format']}), 400

        if profile_picture is not None:
            if profile_picture:
                # Compress the image before storing
                logger.info("Compressing profile picture...")
                compressed_image = compress_image_base64(profile_picture)
                if compressed_image:
                    update_data['profile_picture'] = compressed_image
                    logger.info("Profile picture compressed successfully")
                else:
                    logger.warning("Image compression failed, storing original")
                    update_data['profile_picture'] = profile_picture
            else:
                # Remove profile picture if null/empty string
                update_data['profile_picture'] = None

        if banner is not None:
            if banner:
                # Compress the banner image before storing
                logger.info("Compressing banner image...")
                compressed_banner = compress_image_base64(banner)
                if compressed_banner:
                    update_data['banner'] = compressed_banner
                    logger.info("Banner image compressed successfully")
                else:
                    logger.warning("Banner compression failed, storing original")
                    update_data['banner'] = banner
            else:
                # Remove banner if null/empty string
                update_data['banner'] = None

        success = user_model.update_profile(user_id, update_data)

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








@users_bp.route('/request-deletion-code', methods=['POST'])
@require_auth()
@log_requests
def request_deletion_code():
    """Request a verification code for account deletion."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        
        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
            
        user = current_user_result['user']
        user_id = user['id']
        email = user['email']
        username = user.get('username', 'User')

        # Generate 6-digit code
        import random
        import string
        code = ''.join(random.choices(string.digits, k=6))
        
        # Store code in user record
        user_model = User(current_app.db)
        success = user_model.set_deletion_code(user_id, code)
        
        if success:
            # Send email
            # We need to use the EmailService. Since it's not injected yet, we instantiate it.
            # Assuming EmailService is in services.email_service
            try:
                from services.email_service import EmailService
                email_service = EmailService()
                
                # Use current app config if needed, or environment variables are loaded
                # The send_account_deletion_email method signature: (to_email, username, verification_code, lang='en')
                # We can get language from user preferences
                lang = user.get('preferences', {}).get('language', 'en')
                
                email_service.send_account_deletion_email(email, username, code, lang)
                
                return jsonify({
                    'success': True, 
                    'message': 'Verification code sent to your email'
                }), 200
            except Exception as e:
                logger.error(f"Failed to send deletion email: {str(e)}")
                return jsonify({'success': False, 'errors': ['Failed to send verification email']}), 500
        else:
            return jsonify({'success': False, 'errors': ['Failed to generate verification code']}), 500

    except Exception as e:
        logger.error(f"Request deletion code error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Internal server error']}), 500


@users_bp.route('/delete-account', methods=['DELETE'])
@require_json
@require_auth()
@log_requests
def delete_account():
    """Permanently delete user account."""
    try:
        data = request.get_json()
        verification_code = data.get('verification_code', '')
        totp_code = data.get('totp_code', '')
        
        if not verification_code:
            return jsonify({'success': False, 'errors': ['Verification code is required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        
        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
            
        user = current_user_result['user']
        user_id = user['id']
        
        user_model = User(current_app.db)
        
        # 1. Verify Email Code
        if not user_model.verify_deletion_code(user_id, verification_code):
            return jsonify({'success': False, 'errors': ['Invalid or expired verification code']}), 400
            
        # 2. Verify TOTP if enabled
        # The frontend calls deletion after validating both, but we MUST validate on backend too.
        if user.get('totp_enabled', False):
            if not totp_code:
                return jsonify({'success': False, 'errors': ['TOTP code is required']}), 400
            
            if not user_model.verify_totp(user_id, totp_code, require_enabled=True):
                 return jsonify({'success': False, 'errors': ['Invalid TOTP code']}), 400

        # 3. Delete Account
        success = user_model.delete_user_permanently(user_id)
        
        if success:
            # Clear session
            session.clear()
            return jsonify({
                'success': True,
                'message': 'Account deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to delete account']}), 500

    except Exception as e:
        logger.error(f"Delete account error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Internal server error']}), 500


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
        
        from models.notification_settings import NotificationSettings
        settings_model = NotificationSettings(current_app.db)
        success = settings_model.mute_private_message(user_id, other_user_id, minutes)
        
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





@users_bp.route('/private-messages/<message_id>/delete-for-me', methods=['POST'])
@require_auth()
@log_requests
def delete_private_message_for_me(message_id):
    """Remove a private message for the current user only."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']
        
        pm_model = PrivateMessage(current_app.db)
        success = pm_model.delete_message_for_me(message_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Message removed for you'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Message not found or permission denied']}), 404
            
    except Exception as e:
        logger.error(f"Delete message for me error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to remove message: {str(e)}']}), 500


@users_bp.route('/private-messages/<message_id>/restore-for-me', methods=['POST'])
@require_auth()
@log_requests
def restore_private_message_for_me(message_id):
    """Restore a private message that was deleted for the current user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']
        
        pm_model = PrivateMessage(current_app.db)
        success = pm_model.restore_message_for_me(message_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Message restored'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Message not found or already restored']}), 404
            
    except Exception as e:
        logger.error(f"Restore message for me error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to restore message: {str(e)}']}), 500


@users_bp.route('/private-messages/deleted', methods=['GET'])
@require_auth()
@log_requests
def get_deleted_private_messages():
    """Get all private messages deleted for the current user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']
        
        pm_model = PrivateMessage(current_app.db)
        messages = pm_model.get_deleted_messages_for_user(user_id)
        
        return jsonify({
            'success': True,
            'data': messages
        }), 200
            
    except Exception as e:
        logger.error(f"Get deleted messages error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get deleted messages: {str(e)}']}), 500


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
        
        user = current_user_result.get('user')
        if not user:
            return jsonify({'success': False, 'errors': ['User not found']}), 401
        
        from_user_id = user.get('id')
        if not from_user_id:
            logger.error(f"User ID is missing in current_user_result: {current_user_result}")
            return jsonify({'success': False, 'errors': ['Invalid user session']}), 401

        # Validate IDs are not None and are valid strings
        if not to_user_id or to_user_id == 'None' or to_user_id == 'null':
            return jsonify({'success': False, 'errors': ['Invalid to_user_id']}), 400
        
        if not from_user_id or from_user_id == 'None' or from_user_id == 'null':
            return jsonify({'success': False, 'errors': ['Invalid user session']}), 401

        # Validate ObjectId format before passing to model
        try:
            ObjectId(str(from_user_id))
            ObjectId(str(to_user_id))
        except (ValueError, TypeError) as e:
            logger.error(f"Invalid ObjectId format - from_user_id: {from_user_id}, to_user_id: {to_user_id}")
            return jsonify({'success': False, 'errors': ['Invalid user ID format']}), 400

        friend_model = Friend(current_app.db)
        result = friend_model.send_friend_request(str(from_user_id).strip(), str(to_user_id).strip())

        # Emit socket event to notify the recipient
        try:
            from models.user import User
            user_model = User(current_app.db)
            sender = user_model.get_user_by_id(from_user_id)
            
            socketio = current_app.extensions.get('socketio')
            if socketio and sender:
                created_at = result.get('created_at')
                if isinstance(created_at, datetime):
                    created_at = created_at.isoformat()
                elif not isinstance(created_at, str):
                    created_at = datetime.utcnow().isoformat()
                
                socketio.emit('friend_request_received', {
                    'request_id': result.get('id'),
                    'from_user_id': from_user_id,
                    'from_username': sender.get('username', 'Unknown'),
                    'to_user_id': to_user_id,
                    'created_at': created_at or datetime.utcnow().isoformat()
                }, room=f"user_{to_user_id}")
        except Exception as e:
            logger.warning(f"Failed to emit friend request notification: {str(e)}")

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


@users_bp.route('/search-for-mention', methods=['GET'])
@require_auth()
@log_requests
def search_users_for_mention():
    """Search users for @ mention autocomplete in a specific chat/topic."""
    try:
        query = request.args.get('q', '').strip()
        chat_room_id = request.args.get('chat_room_id')
        topic_id = request.args.get('topic_id')

        if not query or len(query) < 1:
            return jsonify({'success': True, 'data': []}), 200

        from flask import current_app
        user_model = User(current_app.db)
        
        # Search users
        users = user_model.search_users(query, limit=10)
        
        # If in a specific chat/topic, could filter to only members (optional enhancement)
        # For now, return all matching users with minimal info for autocomplete
        mention_users = []
        for user in users:
            mention_users.append({
                'id': user['id'],
                'username': user['username'],
                'profile_picture': user.get('profile_picture'),
                'display_name': user['username']
            })

        return jsonify({
            'success': True,
            'data': mention_users
        }), 200

    except Exception as e:
        logger.error(f"Search users for mention error: {str(e)}", exc_info=True)
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
        from socketio_handlers import connected_users
        
        online_users = []
        for user_id, user_data in connected_users.items():
            if user_data.get('is_online', False):
                connected_at = user_data.get('connected_at')
                if connected_at and hasattr(connected_at, 'isoformat'):
                    connected_at_str = connected_at.isoformat()
                else:
                    connected_at_str = str(connected_at) if connected_at else ''
                
                online_users.append({
                    'id': user_id,
                    'user_id': user_id,
                    'username': user_data.get('username', ''),
                    'connected_at': connected_at_str
                })

        return jsonify({
            'success': True,
            'data': online_users
        }), 200

    except Exception as e:
        logger.error(f"Get online users error: {str(e)}", exc_info=True)
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


# Topic and Chat Room Muting Endpoints
@users_bp.route('/topics/<topic_id>/mute', methods=['POST'])
@require_json
@require_auth()
@log_requests
def mute_topic(topic_id):
    """Mute notifications from a topic."""
    try:
        data = request.get_json()
        minutes = int(data.get('minutes', -1))

        if minutes < -1:
            return jsonify({'success': False, 'errors': ['Invalid mute duration']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.mute_topic(user_id, topic_id, minutes)

        if success:
            return jsonify({
                'success': True,
                'message': 'Topic muted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mute topic']}), 500

    except Exception as e:
        logger.error(f"Mute topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute topic: {str(e)}']}), 500


@users_bp.route('/topics/<topic_id>/unmute', methods=['POST'])
@require_auth()
@log_requests
def unmute_topic(topic_id):
    """Unmute notifications from a topic."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.unmute_topic(user_id, topic_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Topic unmuted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unmute topic']}), 500

    except Exception as e:
        logger.error(f"Unmute topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unmute topic: {str(e)}']}), 500


@users_bp.route('/chat-rooms/<chat_room_id>/mute', methods=['POST'])
@require_json
@require_auth()
@log_requests
def mute_chat_room(chat_room_id):
    """Mute notifications from a chat room."""
    try:
        data = request.get_json()
        minutes = int(data.get('minutes', -1))

        if minutes < -1:
            return jsonify({'success': False, 'errors': ['Invalid mute duration']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.mute_chat_room(user_id, chat_room_id, minutes)

        if success:
            return jsonify({
                'success': True,
                'message': 'Chat room muted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mute chat room']}), 500

    except Exception as e:
        logger.error(f"Mute chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute chat room: {str(e)}']}), 500


@users_bp.route('/chat-rooms/<chat_room_id>/unmute', methods=['POST'])
@require_auth()
@log_requests
def unmute_chat_room(chat_room_id):
    """Unmute notifications from a chat room."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.unmute_chat_room(user_id, chat_room_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Chat room unmuted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unmute chat room']}), 500

    except Exception as e:
        logger.error(f"Unmute chat room error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unmute chat room: {str(e)}']}), 500


@users_bp.route('/posts/<post_id>/mute', methods=['POST'])
@require_json
@require_auth()
@log_requests
def mute_post(post_id):
    """Mute notifications from a post."""
    try:
        data = request.get_json()
        minutes = int(data.get('minutes', -1))

        if minutes < -1:
            return jsonify({'success': False, 'errors': ['Invalid mute duration']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.mute_post(user_id, post_id, minutes)

        if success:
            return jsonify({
                'success': True,
                'message': 'Post muted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mute post']}), 500

    except Exception as e:
        logger.error(f"Mute post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute post: {str(e)}']}), 500


@users_bp.route('/posts/<post_id>/unmute', methods=['POST'])
@require_auth()
@log_requests
def unmute_post(post_id):
    """Unmute notifications from a post."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.unmute_post(user_id, post_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Post unmuted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unmute post']}), 500

    except Exception as e:
        logger.error(f"Unmute post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unmute post: {str(e)}']}), 500


@users_bp.route('/chats/<chat_id>/mute', methods=['POST'])
@require_json
@require_auth()
@log_requests
def mute_chat(chat_id):
    """Mute notifications from a chat."""
    try:
        from models.chat_room import ChatRoom
        
        data = request.get_json()
        minutes = int(data.get('minutes', -1))

        if minutes < -1:
            return jsonify({'success': False, 'errors': ['Invalid mute duration']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        # Get chat to find topic_id
        chat_model = ChatRoom(current_app.db)
        chat = chat_model.get_chat_room_by_id(chat_id)
        if not chat:
            return jsonify({'success': False, 'errors': ['Chat not found']}), 404
        
        topic_id = chat.get('topic_id')
        if not topic_id:
            return jsonify({'success': False, 'errors': ['Chat topic not found']}), 404

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.mute_chat(user_id, chat_id, str(topic_id), minutes)

        if success:
            return jsonify({
                'success': True,
                'message': 'Chat muted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mute chat']}), 500

    except Exception as e:
        logger.error(f"Mute chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute chat: {str(e)}']}), 500


@users_bp.route('/chats/<chat_id>/unmute', methods=['POST'])
@require_auth()
@log_requests
def unmute_chat(chat_id):
    """Unmute notifications from a chat."""
    try:
        from models.chat_room import ChatRoom
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        # Get chat to find topic_id
        chat_model = ChatRoom(current_app.db)
        chat = chat_model.get_chat_room_by_id(chat_id)
        if not chat:
            return jsonify({'success': False, 'errors': ['Chat not found']}), 404
        
        topic_id = chat.get('topic_id')
        if not topic_id:
            return jsonify({'success': False, 'errors': ['Chat topic not found']}), 404

        settings_model = ConversationSettings(current_app.db)
        success = settings_model.unmute_chat(user_id, chat_id, str(topic_id))

        if success:
            return jsonify({
                'success': True,
                'message': 'Chat unmuted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unmute chat']}), 500

    except Exception as e:
        logger.error(f"Unmute chat error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unmute chat: {str(e)}']}), 500


# User Blocking Endpoints
@users_bp.route('/<user_id>/block', methods=['POST'])
@require_auth()
@log_requests
def block_user_by_id(user_id):
    """Block a user to prevent them from sending private messages."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        blocker_id = current_user_result['user']['id']

        # Can't block yourself
        if blocker_id == user_id:
            return jsonify({'success': False, 'errors': ['Cannot block yourself']}), 400

        user_model = User(current_app.db)
        
        # Verify target user exists
        target_user = user_model.get_user_by_id(user_id)
        if not target_user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404

        success = user_model.block_user(blocker_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'User blocked successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to block user']}), 500

    except Exception as e:
        logger.error(f"Block user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to block user: {str(e)}']}), 500


@users_bp.route('/<user_id>/unblock', methods=['DELETE', 'POST'])
@require_auth()
@log_requests
def unblock_user_by_id(user_id):
    """Unblock a user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        blocker_id = current_user_result['user']['id']

        user_model = User(current_app.db)
        success = user_model.unblock_user(blocker_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'User unblocked successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['User was not blocked']}), 400

    except Exception as e:
        logger.error(f"Unblock user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unblock user: {str(e)}']}), 500


@users_bp.route('/blocked', methods=['GET'])
@require_auth()
@log_requests
def get_blocked_users():
    """Get list of blocked users."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        user_model = User(current_app.db)
        blocked_users = user_model.get_blocked_users(user_id)
        
        # get_blocked_users already returns a list of user dicts with id, username, email, profile_picture
        # Just format it for the response
        formatted_users = []
        for user in blocked_users:
            formatted_users.append({
                'id': user.get('id', ''),
                'username': user.get('username', 'Unknown'),
                'profile_picture': user.get('profile_picture')
            })
        
        return jsonify({
            'success': True,
            'data': formatted_users
        }), 200

    except Exception as e:
        logger.error(f"Get blocked users error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get blocked users: {str(e)}']}), 500


@users_bp.route('/username/<username>', methods=['GET'])
@require_auth()
@log_requests
def get_user_by_username(username):
    """Get user info by username."""
    try:
        from socketio_handlers import connected_users
        
        user_model = User(current_app.db)
        user = user_model.get_user_by_username(username)
        
        if not user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404
        
        user_id = user['id']
        
        # Check if user is online
        is_online = user_id in connected_users and connected_users[user_id].get('is_online', False)
        last_seen = None
        
        if not is_online:
            # User is offline, use last_online from database (WebSocket disconnect timestamp)
            last_online = user.get('last_online')
            if last_online:
                if hasattr(last_online, 'isoformat'):
                    last_seen = last_online.isoformat()
                else:
                    last_seen = str(last_online)
            else:
                # Fallback to last_login if no last_online available (old users)
                last_seen = user.get('last_login')
                if last_seen and hasattr(last_seen, 'isoformat'):
                    last_seen = last_seen.isoformat()
                elif last_seen:
                    last_seen = str(last_seen)
        # If user is online, last_seen should be None (they're currently online)
        
        # Remove sensitive info
        user_info = {
            'id': user['id'],
            'username': user['username'],
            'profile_picture': user.get('profile_picture'),
            'banner': user.get('banner'),
            'country_code': user.get('country_code'),
            'created_at': user.get('created_at'),
            'last_login': user.get('last_login'),
            'last_seen': last_seen,
            'is_online': is_online
        }
        
        return jsonify({
            'success': True,
            'data': user_info
        }), 200

    except Exception as e:
        logger.error(f"Get user by username error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get user: {str(e)}']}), 500


@users_bp.route('/<user_id>', methods=['GET'])
@require_auth()
@log_requests
def get_user_by_id(user_id):
    """Get user info by ID."""
    try:
        from socketio_handlers import connected_users
        
        user_model = User(current_app.db)
        user = user_model.get_user_by_id(user_id)
        
        if not user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404
        
        # Check if user is online
        is_online = user_id in connected_users and connected_users[user_id].get('is_online', False)
        last_seen = None
        
        if not is_online:
            # User is offline, use last_online from database (WebSocket disconnect timestamp)
            last_online = user.get('last_online')
            if last_online:
                if hasattr(last_online, 'isoformat'):
                    last_seen = last_online.isoformat()
                else:
                    last_seen = str(last_online)
            else:
                # Fallback to last_login if no last_online available (old users)
                last_seen = user.get('last_login')
                if last_seen and hasattr(last_seen, 'isoformat'):
                    last_seen = last_seen.isoformat()
                elif last_seen:
                    last_seen = str(last_seen)
        # If user is online, last_seen should be None (they're currently online)
        
        # Remove sensitive info
        user_info = {
            'id': user['id'],
            'username': user['username'],
            'profile_picture': user.get('profile_picture'),
            'banner': user.get('banner'),
            'country_code': user.get('country_code'),
            'created_at': user.get('created_at'),
            'last_login': user.get('last_login'),
            'last_seen': last_seen,
            'is_online': is_online
        }
        
        return jsonify({
            'success': True,
            'data': user_info
        }), 200

    except Exception as e:
        logger.error(f"Get user by ID error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get user: {str(e)}']}), 500


@users_bp.route('/dismiss-warning', methods=['POST'])
@require_auth()
@log_requests
def dismiss_warning():
    """Dismiss the active warning for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        user_model = User(current_app.db)
        
        success = user_model.dismiss_warning(user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Warning dismissed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to dismiss warning']}), 400
            
    except Exception as e:
        logger.error(f"Dismiss warning error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to dismiss warning']}), 500


@users_bp.route('/clear-warning', methods=['POST'])
@require_auth()
@log_requests
def clear_warning():
    """Clear the active warning after it expires (10 seconds)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        user_id = current_user_result['user']['id']
        user_model = User(current_app.db)
        
        success = user_model.clear_warning(user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Warning cleared successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to clear warning']}), 400
            
    except Exception as e:
        logger.error(f"Clear warning error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to clear warning']}), 500


@users_bp.route('/<user_id>/report-profile-image', methods=['POST'])
@require_json
@require_auth()
@log_requests
def report_profile_image(user_id):
    """Report a user's profile image."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        reporter_id = current_user_result['user']['id']

        data = request.get_json()
        reason = data.get('reason', '').strip()
        description = data.get('description', '').strip()

        if not reason:
            return jsonify({'success': False, 'errors': ['Reason is required']}), 400

        # Verify user exists
        user_model = User(current_app.db)
        reported_user = user_model.get_user_by_id(user_id)
        if not reported_user:
            return jsonify({'success': False, 'errors': ['User not found']}), 404

        # Create report
        from models.report import Report
        report_model = Report(current_app.db)
        report_id = report_model.create_report(
            reporter_id=reporter_id,
            reported_user_id=user_id,
            reason=reason,
            description=description,
            content_type='profile_image',
            report_type='profile_image'
        )

        return jsonify({
            'success': True,
            'message': 'Profile image reported successfully',
            'data': {'report_id': report_id}
        }), 201

    except Exception as e:
        logger.error(f"Report profile image error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to report profile image: {str(e)}']}), 500
