from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.theme import Theme
from models.anonymous_identity import AnonymousIdentity
from utils.validators import validate_topic_title, validate_topic_description, validate_tags, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
themes_bp = Blueprint('themes', __name__)


@themes_bp.route('/', methods=['GET'])
@log_requests
def get_themes_legacy():
    """Legacy route - themes now require a topic_id. Returns error with instructions."""
    return jsonify({
        'success': False,
        'errors': ['Themes are now organized within Topics. Please use GET /api/themes/topics/<topic_id> instead. First, get a list of topics using GET /api/topics.']
    }), 400


@themes_bp.route('/topics/<topic_id>', methods=['GET'])
@log_requests
def get_themes_by_topic(topic_id):
    """Get list of themes within a topic (Reddit-style)."""
    try:
        # Validate topic_id
        if not topic_id or topic_id == 'undefined' or topic_id == 'null':
            return jsonify({'success': False, 'errors': ['Topic ID is required']}), 400
        
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
        valid_sort_options = ['last_activity', 'member_count', 'created_at', 'post_count']
        if sort_by not in valid_sort_options:
            sort_by = 'last_activity'

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

        theme_model = Theme(current_app.db)

        # Get themes within topic
        themes = theme_model.get_themes_by_topic(
            topic_id=topic_id,
            sort_by=sort_by,
            limit=limit,
            offset=offset,
            tags=tags if tags else None,
            search=search if search else None
        )

        # Get total count for pagination
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
            total_count = theme_model.collection.count_documents(query)
        except Exception as count_error:
            logger.warning(f"Error counting themes: {str(count_error)}")
            total_count = len(themes) + offset if len(themes) == limit else len(themes)

        response_data = {
            'success': True,
            'data': themes,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total_count': total_count,
                'has_more': offset + limit < total_count
            }
        }
        
        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Get themes error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get themes: {str(e)}']}), 500


@themes_bp.route('/topics/<topic_id>', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_theme(topic_id):
    """Create a new theme within a topic (Reddit-style)."""
    try:
        # Validate topic_id
        if not topic_id or topic_id == 'undefined' or topic_id == 'null':
            return jsonify({'success': False, 'errors': ['Topic ID is required']}), 400
        
        logger.info(f"[CREATE_THEME] Starting theme creation for topic {topic_id}")
        data = request.get_json()

        if not data:
            logger.error("[CREATE_THEME] No JSON data received")
            return jsonify({'success': False, 'errors': ['No data provided']}), 400

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

        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        tags = data.get('tags', [])
        allow_anonymous = data.get('allow_anonymous', True)
        require_approval = data.get('require_approval', False)

        logger.info(f"[CREATE_THEME] Title: {title}, Tags: {tags}")

        # Validate inputs
        title_validation = validate_topic_title(title)
        if not title_validation['valid']:
            logger.warning(f"[CREATE_THEME] Title validation failed: {title_validation['errors']}")
            return jsonify({'success': False, 'errors': title_validation['errors']}), 400

        description_validation = validate_topic_description(description)
        if not description_validation['valid']:
            logger.warning(f"[CREATE_THEME] Description validation failed: {description_validation['errors']}")
            return jsonify({'success': False, 'errors': description_validation['errors']}), 400

        tags_validation = validate_tags(tags)
        if not tags_validation['valid']:
            logger.warning(f"[CREATE_THEME] Tags validation failed: {tags_validation['errors']}")
            return jsonify({'success': False, 'errors': tags_validation['errors']}), 400

        cleaned_tags = tags_validation.get('cleaned_tags', [])
        logger.info(f"[CREATE_THEME] Cleaned tags: {cleaned_tags}")

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()

        if not current_user_result.get('success'):
            logger.error(f"[CREATE_THEME] Failed to get current user")
            return jsonify({'success': False, 'errors': ['Authentication failed']}), 401

        user_id = current_user_result['user']['id']
        logger.info(f"[CREATE_THEME] Creating theme for user: {user_id}")

        # Create theme
        theme_model = Theme(current_app.db)
        theme_id = theme_model.create_theme(
            topic_id=topic_id,
            title=title,
            description=description,
            owner_id=user_id,
            tags=cleaned_tags,
            allow_anonymous=allow_anonymous,
            require_approval=require_approval
        )

        logger.info(f"[CREATE_THEME] Theme created with ID: {theme_id}")

        # Get created theme
        created_theme = theme_model.get_theme_by_id(theme_id)

        if not created_theme:
            logger.error(f"[CREATE_THEME] Failed to retrieve created theme")
            return jsonify({'success': False, 'errors': ['Theme created but could not be retrieved']}), 500

        logger.info(f"[CREATE_THEME] Successfully created theme: {created_theme.get('title')}")
        response = jsonify({
            'success': True,
            'message': 'Theme created successfully',
            'data': created_theme
        })
        return response, 201

    except Exception as e:
        logger.error(f"[CREATE_THEME] Exception: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create theme: {str(e)}']}), 500


@themes_bp.route('/<theme_id>', methods=['GET'])
@log_requests
def get_theme(theme_id):
    """Get details of a specific theme."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        # Validate ObjectId format
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        theme_model = Theme(current_app.db)
        theme = theme_model.get_theme_by_id(theme_id)
        if not theme:
            return jsonify({'success': False, 'errors': ['Theme not found']}), 404

        # Get user permission level if authenticated
        permission_level = 0
        auth_service = AuthService(current_app.db)
        if auth_service.is_authenticated():
            current_user_result = auth_service.get_current_user()
            if current_user_result['success']:
                user_id = current_user_result['user']['id']
                permission_level = theme_model.get_user_permission_level(theme_id, user_id)

        theme['user_permission_level'] = permission_level

        return jsonify({
            'success': True,
            'data': theme
        }), 200

    except Exception as e:
        logger.error(f"Get theme error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get theme: {str(e)}']}), 500


@themes_bp.route('/<theme_id>', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_theme(theme_id):
    """Update theme details (only owner can update)."""
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

        # Update theme
        theme_model = Theme(current_app.db)
        success = theme_model.update_theme(theme_id, user_id, updates)

        if success:
            updated_theme = theme_model.get_theme_by_id(theme_id)
            return jsonify({
                'success': True,
                'message': 'Theme updated successfully',
                'data': updated_theme
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or theme not found']}), 403

    except Exception as e:
        logger.error(f"Update theme error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to update theme: {str(e)}']}), 500


@themes_bp.route('/<theme_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_theme(theme_id):
    """Delete a theme (only owner can delete)."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        theme_model = Theme(current_app.db)
        success = theme_model.delete_theme(theme_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Theme deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or theme not found']}), 403

    except Exception as e:
        logger.error(f"Delete theme error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to delete theme: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/join', methods=['POST'])
@require_auth()
@log_requests
def join_theme(theme_id):
    """Join a theme."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        theme_model = Theme(current_app.db)
        success = theme_model.add_member(theme_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Joined theme successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to join theme or already a member']}), 400

    except Exception as e:
        logger.error(f"Join theme error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to join theme: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/leave', methods=['POST'])
@require_auth()
@log_requests
def leave_theme(theme_id):
    """Leave a theme."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        theme_model = Theme(current_app.db)
        success = theme_model.remove_member(theme_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Left theme successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to leave theme or not a member']}), 400

    except Exception as e:
        logger.error(f"Leave theme error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to leave theme: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/moderators', methods=['GET'])
@log_requests
def get_theme_moderators(theme_id):
    """Get moderators for a theme."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        theme_model = Theme(current_app.db)
        moderators = theme_model.get_moderators(theme_id)

        return jsonify({
            'success': True,
            'data': moderators
        }), 200

    except Exception as e:
        logger.error(f"Get theme moderators error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get moderators: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/moderators', methods=['POST'])
@require_json
@require_auth()
@log_requests
def add_moderator(theme_id):
    """Add a moderator to a theme (only owner)."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
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

        theme_model = Theme(current_app.db)
        success = theme_model.add_moderator(theme_id, user_id, moderator_id, permissions)

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


@themes_bp.route('/<theme_id>/moderators/<moderator_id>', methods=['DELETE'])
@require_auth()
@log_requests
def remove_moderator(theme_id, moderator_id):
    """Remove a moderator from a theme (only owner)."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        # Validate moderator_id
        if not moderator_id or moderator_id == 'undefined' or moderator_id == 'null':
            return jsonify({'success': False, 'errors': ['Moderator ID is required']}), 400
        
        try:
            ObjectId(moderator_id)
        except Exception as e:
            logger.error(f"Invalid moderator_id format: {moderator_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid moderator ID format']}), 400
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        theme_model = Theme(current_app.db)
        success = theme_model.remove_moderator(theme_id, user_id, moderator_id)

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


@themes_bp.route('/<theme_id>/ban', methods=['POST'])
@require_json
@require_auth()
@log_requests
def ban_user_from_theme(theme_id):
    """Ban a user from a theme (owner or moderator)."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
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

        theme_model = Theme(current_app.db)
        success = theme_model.ban_user_from_theme(theme_id, user_to_ban_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'User banned from theme successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Ban user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to ban user: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/unban', methods=['POST'])
@require_json
@require_auth()
@log_requests
def unban_user_from_theme(theme_id):
    """Unban a user from a theme (owner or moderator)."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        data = request.get_json()
        user_to_unban_id = data.get('user_id')

        if not user_to_unban_id:
            return jsonify({'success': False, 'errors': ['User ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        theme_model = Theme(current_app.db)
        success = theme_model.unban_user_from_theme(theme_id, user_to_unban_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'User unbanned from theme successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or user not found']}), 403

    except Exception as e:
        logger.error(f"Unban user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to unban user: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/transfer-ownership', methods=['POST'])
@require_json
@require_auth()
@log_requests
def transfer_ownership(theme_id):
    """Transfer theme ownership to another user."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        try:
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        data = request.get_json()
        new_owner_id = data.get('user_id')

        if not new_owner_id:
            return jsonify({'success': False, 'errors': ['New owner ID is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        theme_model = Theme(current_app.db)
        success = theme_model.transfer_ownership(theme_id, user_id, new_owner_id)

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


@themes_bp.route('/my', methods=['GET'])
@require_auth()
@log_requests
def get_user_themes():
    """Get themes that the current user is a member of."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        theme_model = Theme(current_app.db)
        themes = theme_model.get_user_themes(user_id)

        return jsonify({
            'success': True,
            'data': themes
        }), 200

    except Exception as e:
        logger.error(f"Get user themes error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get user themes: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/anonymous-identity', methods=['GET'])
@require_auth()
@log_requests
def get_anonymous_identity(theme_id):
    """Get user's anonymous identity for a theme."""
    try:
        # Validate theme_id
        if not theme_id or theme_id == 'undefined' or theme_id == 'null':
            return jsonify({'success': False, 'errors': ['Theme ID is required']}), 400
        
        # Validate ObjectId format
        try:
            from bson import ObjectId
            ObjectId(theme_id)
        except Exception as e:
            logger.error(f"Invalid theme_id format: {theme_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid theme ID format']}), 400
        
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        anon_model = AnonymousIdentity(current_app.db)
        anonymous_name = anon_model.get_anonymous_identity(user_id, theme_id)

        return jsonify({
            'success': True,
            'data': {
                'anonymous_name': anonymous_name,
                'theme_id': theme_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Get anonymous identity error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get anonymous identity: {str(e)}']}), 500


@themes_bp.route('/<theme_id>/anonymous-identity', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_anonymous_identity(theme_id):
    """Update user's anonymous identity for a theme."""
    try:
        data = request.get_json()
        new_name = data.get('new_name', '').strip()

        if not new_name:
            return jsonify({'success': False, 'errors': ['New name is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        anon_model = AnonymousIdentity(current_app.db)
        success = anon_model.update_anonymous_identity(user_id, theme_id, new_name)

        if success:
            return jsonify({
                'success': True,
                'message': 'Anonymous identity updated successfully',
                'data': {
                    'anonymous_name': new_name,
                    'theme_id': theme_id
                }
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to update anonymous identity']}), 400

    except Exception as e:
        logger.error(f"Update anonymous identity error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to update anonymous identity: {str(e)}']}), 500

