from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from models.conversation_settings import ConversationSettings
from utils.validators import validate_topic_title, validate_topic_description, validate_tags, validate_pagination_params
from utils.validators import validate_topic_title, validate_topic_description, validate_tags, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
from utils.cache_decorator import cache_result
import hashlib
import json
import logging

logger = logging.getLogger(__name__)
topics_bp = Blueprint('topics', __name__)


def get_topics_cache_key(func_name, args, kwargs):
    """Generate cache key for topic list based on request args."""
    # Create a unique key based on query parameters
    params = [
        request.args.get('sort_by', 'last_activity'),
        request.args.get('limit', '20'),
        request.args.get('offset', '0'),
        request.args.get('search', ''),
        ','.join(sorted(request.args.getlist('tags')))
    ]
    key_string = '_'.join(str(p) for p in params)
    key_hash = hashlib.md5(key_string.encode()).hexdigest()
    return f"topic:list:{key_hash}"

@topics_bp.route('/', methods=['GET'])
@log_requests
@cache_result(ttl=300, key_func=get_topics_cache_key)
def get_topics():
    """Get list of public topics with filtering and pagination."""
    try:
        # Parse query parameters
        sort_by = request.args.get('sort_by', 'last_activity')
        tags = request.args.getlist('tags')
        search = request.args.get('search', '').strip()
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))

        # Validate pagination
        pagination_result = validate_pagination_params(limit, offset)
        if not pagination_result['valid']:
            return jsonify({'success': False, 'errors': pagination_result['errors']}), 400

        limit = pagination_result['limit']
        offset = pagination_result['offset']

        # Validate sort options
        valid_sort_options = ['last_activity', 'member_count', 'created_at']
        if sort_by not in valid_sort_options:
            sort_by = 'last_activity'

        topic_model = Topic(current_app.db)

        # Get current user if authenticated
        user_id = None
        try:
            auth_service = AuthService(current_app.db)
            if auth_service.is_authenticated():
                current_user_result = auth_service.get_current_user()
                if current_user_result.get('success'):
                    user_id = current_user_result['user']['id']
        except:
            pass

        # Get topics
        topics = topic_model.get_public_topics(
            sort_by=sort_by,
            limit=limit,
            offset=offset,
            tags=tags if tags else None,
            search=search if search else None
        )

        # Get hidden topics and mute status if user is authenticated
        if user_id:
            from models.user_content_settings import UserContentSettings
            ucs_model = UserContentSettings(current_app.db)
            from models.notification_settings import NotificationSettings
            ns_model = NotificationSettings(current_app.db)
            
            filtered_topics = []
            for topic in topics:
                t_id = str(topic['id'])
                # Filter hidden topics
                if ucs_model.is_topic_hidden(user_id, t_id):
                    continue
                
                # Check for invite-only access (require_approval = True)
                # Users can see it if:
                # 1. It's NOT invite only (require_approval is False/missing)
                # 2. They are the owner
                # 3. They are a member (user_permission_level > 0)
                
                is_invite_only = topic.get('settings', {}).get('require_approval', False)
                is_owner = str(topic.get('owner_id')) == str(user_id)
                
                # Ensure permission level is calculated
                permission_level = topic_model.calculate_permission_level(topic, user_id)
                topic['user_permission_level'] = permission_level
                
                is_member = permission_level > 0
                
                if is_invite_only and not is_owner and not is_member:
                    continue

                # Add mute status
                topic['is_muted'] = ns_model.is_topic_muted(user_id, t_id)
                
                filtered_topics.append(topic)
            
            topics = filtered_topics
        else:
            # Set defaults for unauthenticated users and filter invite-only
            public_topics = []
            for topic in topics:
                is_invite_only = topic.get('settings', {}).get('require_approval', False)
                if is_invite_only:
                    continue
                    
                topic['user_permission_level'] = 0
                topic['is_muted'] = False
                public_topics.append(topic)
            topics = public_topics

        # Get total count for pagination (more efficient - use count_documents)
        try:
            from bson import ObjectId
            query = {'is_public': True}
            if tags:
                query['tags'] = {'$in': tags}
            if search:
                query['$or'] = [
                    {'title': {'$regex': search, '$options': 'i'}},
                    {'description': {'$regex': search, '$options': 'i'}}
                ]
            total_count = topic_model.collection.count_documents(query)
        except Exception as count_error:
            logger.warning(f"Error counting topics: {str(count_error)}")
            # Fallback: estimate based on current results
            total_count = len(topics) + offset if len(topics) == limit else len(topics)

        response_data = {
            'success': True,
            'data': topics,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total_count': total_count,
                'has_more': offset + limit < total_count
            }
        }
        
        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Get topics error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get topics: {str(e)}']}), 500


@topics_bp.route('/', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_topic():
    """Create a new topic."""
    try:
        logger.info("[CREATE_TOPIC] Starting topic creation")
        data = request.get_json()

        if not data:
            logger.error("[CREATE_TOPIC] No JSON data received")
            return jsonify({'success': False, 'errors': ['No data provided']}), 400

        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        tags = data.get('tags', [])
        allow_anonymous = data.get('allow_anonymous', True)
        require_approval = data.get('require_approval', False)

        logger.info(f"[CREATE_TOPIC] Title: {title}, Tags: {tags}")

        # Validate inputs
        title_validation = validate_topic_title(title)
        if not title_validation['valid']:
            logger.warning(f"[CREATE_TOPIC] Title validation failed: {title_validation['errors']}")
            return jsonify({'success': False, 'errors': title_validation['errors']}), 400

        description_validation = validate_topic_description(description)
        if not description_validation['valid']:
            logger.warning(f"[CREATE_TOPIC] Description validation failed: {description_validation['errors']}")
            return jsonify({'success': False, 'errors': description_validation['errors']}), 400

        tags_validation = validate_tags(tags)
        if not tags_validation['valid']:
            logger.warning(f"[CREATE_TOPIC] Tags validation failed: {tags_validation['errors']}")
            return jsonify({'success': False, 'errors': tags_validation['errors']}), 400

        cleaned_tags = tags_validation.get('cleaned_tags', [])
        logger.info(f"[CREATE_TOPIC] Cleaned tags: {cleaned_tags}")

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()

        if not current_user_result.get('success'):
            logger.error(f"[CREATE_TOPIC] Failed to get current user")
            return jsonify({'success': False, 'errors': ['Authentication failed']}), 401

        user_id = current_user_result['user']['id']
        logger.info(f"[CREATE_TOPIC] Creating topic for user: {user_id}")

        # Create topic
        topic_model = Topic(current_app.db)
        try:
            topic_id = topic_model.create_topic(
                title=title,
                description=description,
                owner_id=user_id,
                tags=cleaned_tags,
                allow_anonymous=allow_anonymous,
                require_approval=require_approval
            )
        except ValueError as e:
            # Handle duplicate topic name error
            error_message = str(e)
            logger.warning(f"[CREATE_TOPIC] Topic creation failed: {error_message}")
            return jsonify({'success': False, 'errors': [error_message]}), 409  # 409 Conflict

        logger.info(f"[CREATE_TOPIC] Topic created with ID: {topic_id}")

        # Get created topic
        created_topic = topic_model.get_topic_by_id(topic_id)

        if not created_topic:
            logger.error(f"[CREATE_TOPIC] Failed to retrieve created topic")
            return jsonify({'success': False, 'errors': ['Topic created but could not be retrieved']}), 500

        logger.info(f"[CREATE_TOPIC] Successfully created topic: {created_topic.get('title')}")
        
        # Emit socket event for topic creation
        try:
            from app import socketio
            if socketio:
                socketio.emit('topic_created', {
                    'topic_id': str(topic_id),
                    'topic': created_topic
                })
                logger.info(f"[CREATE_TOPIC] Emitted topic_created event for topic {topic_id}")
        except Exception as e:
            logger.warning(f"[CREATE_TOPIC] Failed to emit socket event: {str(e)}")
        
        response = jsonify({
            'success': True,
            'message': 'Topic created successfully',
            'data': created_topic
        })
        
        # Invalidate topic list cache
        if current_app.config.get('CACHE_INVALIDATOR'):
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern('topic:list:*')
            
        return response, 201

    except Exception as e:
        logger.error(f"[CREATE_TOPIC] Exception: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>', methods=['GET'])
@log_requests
@cache_result(ttl=300, key_func=lambda f, a, k: f"topic:{k.get('topic_id')}")
def get_topic(topic_id):
    """Get details of a specific topic."""
    try:
        topic_model = Topic(current_app.db)

        topic = topic_model.get_topic_by_id(topic_id)
        if not topic:
            return jsonify({'success': False, 'errors': ['Topic not found']}), 404

        # Get user permission level if authenticated
        permission_level = 0
        auth_service = AuthService(current_app.db)
        if auth_service.is_authenticated():
            current_user_result = auth_service.get_current_user()
            if current_user_result['success']:
                user_id = current_user_result['user']['id']
                permission_level = topic_model.get_user_permission_level(topic_id, user_id)

        topic['user_permission_level'] = permission_level

        return jsonify({
            'success': True,
            'data': topic
        }), 200

    except Exception as e:
        logger.error(f"Get topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_topic(topic_id):
    """Update topic details (only owner can update)."""
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        tags = data.get('tags', [])
        settings = data.get('settings', {})

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        # Validate inputs if provided
        updates = {}

        if title:
            title_validation = validate_topic_title(title)
            if not title_validation['valid']:
                return jsonify({'success': False, 'errors': title_validation['errors']}), 400
            updates['title'] = title

        if description is not None:
            description_validation = validate_topic_description(description)
            if not description_validation['valid']:
                return jsonify({'success': False, 'errors': description_validation['errors']}), 400
            updates['description'] = description

        if tags:
            tags_validation = validate_tags(tags)
            if not tags_validation['valid']:
                return jsonify({'success': False, 'errors': tags_validation['errors']}), 400
            updates['tags'] = tags_validation.get('cleaned_tags', [])

        if settings:
            # Validate settings
            valid_settings = ['allow_anonymous', 'require_approval']
            filtered_settings = {k: v for k, v in settings.items() if k in valid_settings}
            if filtered_settings:
                updates['settings'] = filtered_settings

        if not updates:
            return jsonify({'success': False, 'errors': ['No valid updates provided']}), 400

        # Update topic
        topic_model = Topic(current_app.db)
        success = topic_model.update_topic(topic_id, user_id, updates)

        if success:
            updated_topic = topic_model.get_topic_by_id(topic_id)
            
            # Emit socket event for topic update
            try:
                from app import socketio
                if socketio:
                    socketio.emit('topic_updated', {
                        'topic_id': str(topic_id),
                        'topic': updated_topic
                    })
                    logger.info(f"[UPDATE_TOPIC] Emitted topic_updated event for topic {topic_id}")
            except Exception as e:
                logger.warning(f"[UPDATE_TOPIC] Failed to emit socket event: {str(e)}")
            
            # Invalidate topic cache
            if current_app.config.get('CACHE_INVALIDATOR'):
                current_app.config['CACHE_INVALIDATOR'].invalidate_entity('topic', topic_id)

            return jsonify({
                'success': True,
                'message': 'Topic updated successfully',
                'data': updated_topic
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or topic not found']}), 403

    except Exception as e:
        logger.error(f"Update topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to update topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_topic(topic_id):
    """Delete a topic (only owner can delete)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.delete_topic(topic_id, user_id)

        if success:
            # Invalidate topic cache
            if current_app.config.get('CACHE_INVALIDATOR'):
                current_app.config['CACHE_INVALIDATOR'].invalidate_entity('topic', topic_id)

            return jsonify({
                'success': True,
                'message': 'Topic deletion requested. It will be permanently deleted in 7 days pending admin approval.'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or topic not found']}), 403

    except Exception as e:
        logger.error(f"Delete topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to delete topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/join', methods=['POST'])
@require_auth()
@log_requests
def join_topic(topic_id):
    """Join a topic."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.add_member(topic_id, user_id)

        if success:
            # Invalidate topic cache (member count changed)
            if current_app.config.get('CACHE_INVALIDATOR'):
                current_app.config['CACHE_INVALIDATOR'].invalidate_entity('topic', topic_id)

            return jsonify({
                'success': True,
                'message': 'Joined topic successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to join topic or already a member']}), 400

    except Exception as e:
        logger.error(f"Join topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to join topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/leave', methods=['POST'])
@require_auth()
@log_requests
def leave_topic(topic_id):
    """Leave a topic."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.remove_member(topic_id, user_id)

        if success:
            # Invalidate topic cache (member count changed)
            if current_app.config.get('CACHE_INVALIDATOR'):
                current_app.config['CACHE_INVALIDATOR'].invalidate_entity('topic', topic_id)

            return jsonify({
                'success': True,
                'message': 'Left topic successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to leave topic or not a member']}), 400

    except Exception as e:
        logger.error(f"Leave topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to leave topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/moderators', methods=['GET'])
@log_requests
def get_topic_moderators(topic_id):
    """Get moderators for a topic."""
    try:
        topic_model = Topic(current_app.db)

        moderators = topic_model.get_moderators(topic_id)

        return jsonify({
            'success': True,
            'data': moderators
        }), 200

    except Exception as e:
        logger.error(f"Get topic moderators error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get moderators: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/moderators', methods=['POST'])
@require_json
@require_auth()
@log_requests
def add_moderator(topic_id):
    """Add a moderator to a topic (only owner)."""
    try:
        data = request.get_json()
        moderator_id = data.get('user_id')
        permissions = data.get('permissions', ['delete_messages', 'ban_users'])

        if not moderator_id:
            return jsonify({'success': False, 'errors': ['User ID is required']}), 400

        valid_permissions = ['delete_messages', 'ban_users', 'timeout_users']
        permissions = [p for p in permissions if p in valid_permissions]

        if not permissions:
            permissions = ['delete_messages']

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.add_moderator(topic_id, user_id, moderator_id, permissions)

        if success:
            return jsonify({
                'success': True,
                'message': 'Moderator added successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Add moderator error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to add moderator: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/moderators/<moderator_id>', methods=['DELETE'])
@require_auth()
@log_requests
def remove_moderator(topic_id, moderator_id):
    """Remove a moderator from a topic (only owner)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.remove_moderator(topic_id, user_id, moderator_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Moderator removed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or moderator not found']}), 403

    except Exception as e:
        logger.error(f"Remove moderator error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to remove moderator: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/ban', methods=['POST'])
@require_json
@require_auth()
@log_requests
def ban_user_from_topic(topic_id):
    """Ban a user from a topic (owner or moderator)."""
    try:
        data = request.get_json()
        user_to_ban_id = data.get('user_id')
        reason = data.get('reason', 'Banned by moderator')
        duration_days = data.get('duration_days')  # Optional, None = permanent

        if not user_to_ban_id:
            return jsonify({'success': False, 'errors': ['User ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.ban_user_from_topic(topic_id, user_to_ban_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'User banned from topic successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Ban user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to ban user: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/unban', methods=['POST'])
@require_json
@require_auth()
@log_requests
def unban_user_from_topic(topic_id):
    """Unban a user from a topic (owner or moderator)."""
    try:
        data = request.get_json()
        user_to_unban_id = data.get('user_id')

        if not user_to_unban_id:
            return jsonify({'success': False, 'errors': ['User ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.unban_user_from_topic(topic_id, user_to_unban_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'User unbanned from topic successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Unban user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unban user: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/transfer-ownership', methods=['POST'])
@require_json
@require_auth()
@log_requests
def transfer_ownership(topic_id):
    """Transfer topic ownership to another user."""
    try:
        data = request.get_json()
        new_owner_id = data.get('user_id')

        if not new_owner_id:
            return jsonify({'success': False, 'errors': ['New owner ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.transfer_ownership(topic_id, user_id, new_owner_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Ownership transferred successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Transfer ownership error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to transfer ownership: {str(e)}']}), 500


@topics_bp.route('/my', methods=['GET'])
@require_auth()
@log_requests
def get_user_topics():
    """Get topics that the current user is a member of."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        topics = topic_model.get_user_topics(user_id)

        return jsonify({
            'success': True,
            'data': topics
        }), 200

    except Exception as e:
        logger.error(f"Get user topics error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get user topics: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/anonymous-identity', methods=['GET'])
@require_auth()
@log_requests
def get_anonymous_identity(topic_id):
    """Get user's anonymous identity for a topic."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        anon_model = AnonymousIdentity(current_app.db)
        anonymous_name = anon_model.get_anonymous_identity(user_id, topic_id)

        return jsonify({
            'success': True,
            'data': {
                'anonymous_name': anonymous_name,
                'topic_id': topic_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Get anonymous identity error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get anonymous identity: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/anonymous-identity', methods=['PUT', 'POST'])
@require_json
@require_auth()
@log_requests
def update_anonymous_identity(topic_id):
    """Create or update user's anonymous identity for a topic."""
    try:
        data = request.get_json()
        new_name = data.get('new_name', '').strip()
        custom_name = data.get('custom_anonymous_name', '').strip() or new_name

        if not custom_name:
            return jsonify({'success': False, 'errors': ['Anonymous name is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        anon_model = AnonymousIdentity(current_app.db)
        
        # Check if identity exists
        existing_identity = anon_model.get_anonymous_identity(user_id, topic_id)
        
        if existing_identity:
            # Update existing identity
            success = anon_model.update_anonymous_identity(user_id, topic_id, custom_name)
            if not success:
                return jsonify({'success': False, 'errors': ['Failed to update anonymous identity. Name may be invalid.']}), 400
        else:
            # Try to create new identity, but if it fails due to duplicate key, try to update instead
            try:
                anonymous_name = anon_model.create_anonymous_identity(user_id, topic_id, custom_name)
                if not anonymous_name:
                    return jsonify({'success': False, 'errors': ['Failed to create anonymous identity. Name may be invalid.']}), 400
            except Exception as create_error:
                error_str = str(create_error)
                # If it's a duplicate key error, try to update instead
                if 'E11000' in error_str or 'duplicate key' in error_str.lower():
                    logger.warning(f"Duplicate key error when creating identity, attempting update instead: {error_str}")
                    # Try to update - this will work if the identity exists but get_anonymous_identity didn't find it
                    # (possibly due to index mismatch)
                    success = anon_model.update_anonymous_identity(user_id, topic_id, custom_name)
                    if not success:
                        # If update also fails, try using upsert approach
                        try:
                            # Use regenerate_anonymous_identity which uses upsert
                            anon_model.regenerate_anonymous_identity(user_id, topic_id)
                            # Then update with the custom name
                            success = anon_model.update_anonymous_identity(user_id, topic_id, custom_name)
                            if not success:
                                return jsonify({'success': False, 'errors': ['Failed to update anonymous identity. Name may be invalid.']}), 400
                        except Exception as upsert_error:
                            logger.error(f"Failed to upsert anonymous identity: {str(upsert_error)}")
                            return jsonify({'success': False, 'errors': [f'Failed to create or update anonymous identity: {str(upsert_error)}']}), 400
                else:
                    logger.error(f"Failed to create anonymous identity: {error_str}")
                    return jsonify({'success': False, 'errors': [f'Failed to create anonymous identity: {error_str}']}), 400

        # Get the final identity name
        final_name = anon_model.get_anonymous_identity(user_id, topic_id)
        return jsonify({
            'success': True,
            'message': 'Anonymous identity set successfully',
            'data': {
                'anonymous_name': final_name or custom_name,
                'topic_id': topic_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Update anonymous identity error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to set anonymous identity: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/mute', methods=['POST'])
@require_json
@require_auth()
@log_requests
def mute_topic(topic_id):
    """Mute a topic for a specified duration."""
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
        success = settings_model.mute_topic(user_id, topic_id, minutes)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Topic muted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': ['Failed to mute topic']
            }), 500
            
    except Exception as e:
        logger.error(f"Mute topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mute topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/unmute', methods=['POST'])
@require_auth()
@log_requests
def unmute_topic(topic_id):
    """Unmute a topic."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']
        
        from models.notification_settings import NotificationSettings
        settings_model = NotificationSettings(current_app.db)
        success = settings_model.unmute_topic(user_id, topic_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Topic unmuted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': ['Failed to unmute topic']
            }), 500
            
    except Exception as e:
        logger.error(f"Unmute topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unmute topic: {str(e)}']}), 500


@topics_bp.route('/<topic_id>/invite', methods=['POST'])
@require_auth()
@require_json
@log_requests
def invite_user_to_topic(topic_id):
    """Invite a user to an invite-only topic."""
    try:
        data = request.get_json()
        invited_user_id = data.get('user_id')

        if not invited_user_id:
            return jsonify({'success': False, 'errors': ['User ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        
        # Verify topic exists
        topic = topic_model.get_topic_by_id(topic_id)
        if not topic:
            return jsonify({'success': False, 'errors': ['Topic not found']}), 404

        # Check if topic requires approval (invite-only)
        if not topic.get('settings', {}).get('require_approval', False):
            return jsonify({'success': False, 'errors': ['This topic is public and does not require invitations']}), 400

        result = topic_model.invite_user(topic_id, invited_user_id, user_id)

        if result == "is_owner":
            return jsonify({'success': False, 'errors': ['Cannot invite the owner of the topic.']}), 400
        elif result == "already_member":
            return jsonify({'success': False, 'errors': ['User is already a member of this topic.']}), 400
        elif result == "already_invited":
            return jsonify({'success': False, 'errors': ['User has already been invited to this topic.']}), 400
        elif result == "is_banned":
            return jsonify({'success': False, 'errors': ['User is banned from this topic.']}), 400
        elif result:  # result is invitation_id (string)
            # Get topic and inviter details for WebSocket event
            from models.user import User
            user_model = User(current_app.db)
            inviter = user_model.get_user_by_id(user_id)
            
            # Emit WebSocket event for invitation
            from extensions import socketio
            if socketio:
                socketio.emit('topic_invitation', {
                    'invitation_id': result,
                    'topic_id': topic_id,
                    'invited_user_id': invited_user_id,
                    'invited_by': user_id,
                    'invited_by_username': inviter.get('username') if inviter else 'Unknown',
                    'topic_title': topic.get('title') if topic else 'Unknown',
                    'topic_description': topic.get('description') if topic else None
                }, room=f"user_{invited_user_id}")

            return jsonify({
                'success': True,
                'message': 'User invited successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to invite user. User may already be invited or you may not have permission.']}), 400

    except Exception as e:
        logger.error(f"Invite user to topic error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to invite user: {str(e)}']}), 500


@topics_bp.route('/invitations', methods=['GET'])
@require_auth()
@log_requests
def get_my_invitations():
    """Get pending topic invitations for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        invitations = topic_model.get_user_invitations(user_id)

        return jsonify({
            'success': True,
            'data': invitations
        }), 200

    except Exception as e:
        logger.error(f"Get invitations error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get invitations: {str(e)}']}), 500


@topics_bp.route('/invitations/<invitation_id>/accept', methods=['POST'])
@require_auth()
@log_requests
def accept_invitation(invitation_id):
    """Accept a topic invitation."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.accept_invitation(invitation_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Invitation accepted'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to accept invitation']}), 400

    except Exception as e:
        logger.error(f"Accept invitation error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to accept invitation: {str(e)}']}), 500


@topics_bp.route('/invitations/<invitation_id>/decline', methods=['POST'])
@require_auth()
@log_requests
def decline_invitation(invitation_id):
    """Decline a topic invitation."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.decline_invitation(invitation_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Invitation declined'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to decline invitation']}), 400

    except Exception as e:
        logger.error(f"Decline invitation error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to decline invitation: {str(e)}']}), 500