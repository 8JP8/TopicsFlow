from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from utils.validators import validate_topic_title, validate_topic_description, validate_tags, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
topics_bp = Blueprint('topics', __name__)


@topics_bp.route('/', methods=['GET'])
@log_requests
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

        from flask import current_app
        topic_model = Topic(current_app.db)

        # Get topics
        topics = topic_model.get_public_topics(
            sort_by=sort_by,
            limit=limit,
            offset=offset,
            tags=tags if tags else None,
            search=search if search else None
        )

        # Get total count for pagination
        total_count = len(topic_model.get_public_topics(
            sort_by=sort_by,
            limit=1000,  # Get more for accurate count
            offset=0,
            tags=tags if tags else None,
            search=search if search else None
        ))

        return jsonify({
            'success': True,
            'data': topics,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total_count': total_count,
                'has_more': offset + limit < total_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get topics error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get topics']}), 500


@topics_bp.route('/', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_topic():
    """Create a new topic."""
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        tags = data.get('tags', [])
        allow_anonymous = data.get('allow_anonymous', True)
        require_approval = data.get('require_approval', False)

        # Validate inputs
        title_validation = validate_topic_title(title)
        if not title_validation['valid']:
            return jsonify({'success': False, 'errors': title_validation['errors']}), 400

        description_validation = validate_topic_description(description)
        if not description_validation['valid']:
            return jsonify({'success': False, 'errors': description_validation['errors']}), 400

        tags_validation = validate_tags(tags)
        if not tags_validation['valid']:
            return jsonify({'success': False, 'errors': tags_validation['errors']}), 400

        cleaned_tags = tags_validation.get('cleaned_tags', [])

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        # Create topic
        topic_model = Topic(current_app.db)
        topic_id = topic_model.create_topic(
            title=title,
            description=description,
            owner_id=user_id,
            tags=cleaned_tags,
            allow_anonymous=allow_anonymous,
            require_approval=require_approval
        )

        # Get created topic
        created_topic = topic_model.get_topic_by_id(topic_id)

        return jsonify({
            'success': True,
            'message': 'Topic created successfully',
            'data': created_topic
        }), 201

    except Exception as e:
        logger.error(f"Create topic error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to create topic']}), 500


@topics_bp.route('/<topic_id>', methods=['GET'])
@log_requests
def get_topic(topic_id):
    """Get details of a specific topic."""
    try:
        from flask import current_app
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
        logger.error(f"Get topic error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get topic']}), 500


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

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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
            return jsonify({
                'success': True,
                'message': 'Topic updated successfully',
                'data': updated_topic
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or topic not found']}), 403

    except Exception as e:
        logger.error(f"Update topic error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to update topic']}), 500


@topics_bp.route('/<topic_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_topic(topic_id):
    """Delete a topic (only owner can delete)."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.delete_topic(topic_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Topic deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or topic not found']}), 403

    except Exception as e:
        logger.error(f"Delete topic error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to delete topic']}), 500


@topics_bp.route('/<topic_id>/join', methods=['POST'])
@require_auth()
@log_requests
def join_topic(topic_id):
    """Join a topic."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.add_member(topic_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Joined topic successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to join topic or already a member']}), 400

    except Exception as e:
        logger.error(f"Join topic error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to join topic']}), 500


@topics_bp.route('/<topic_id>/leave', methods=['POST'])
@require_auth()
@log_requests
def leave_topic(topic_id):
    """Leave a topic."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        topic_model = Topic(current_app.db)
        success = topic_model.remove_member(topic_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Left topic successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to leave topic or not a member']}), 400

    except Exception as e:
        logger.error(f"Leave topic error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to leave topic']}), 500


@topics_bp.route('/<topic_id>/moderators', methods=['GET'])
@log_requests
def get_topic_moderators(topic_id):
    """Get moderators for a topic."""
    try:
        from flask import current_app
        topic_model = Topic(current_app.db)

        moderators = topic_model.get_moderators(topic_id)

        return jsonify({
            'success': True,
            'data': moderators
        }), 200

    except Exception as e:
        logger.error(f"Get topic moderators error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get moderators']}), 500


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

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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
        logger.error(f"Add moderator error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to add moderator']}), 500


@topics_bp.route('/<topic_id>/moderators/<moderator_id>', methods=['DELETE'])
@require_auth()
@log_requests
def remove_moderator(topic_id, moderator_id):
    """Remove a moderator from a topic (only owner)."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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
        logger.error(f"Remove moderator error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to remove moderator']}), 500


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

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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
        logger.error(f"Ban user error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to ban user']}), 500


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

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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
        logger.error(f"Unban user error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to unban user']}), 500


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

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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
        logger.error(f"Transfer ownership error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to transfer ownership']}), 500


@topics_bp.route('/my', methods=['GET'])
@require_auth()
@log_requests
def get_user_topics():
    """Get topics that the current user is a member of."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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


@topics_bp.route('/<topic_id>/anonymous-identity', methods=['GET'])
@require_auth()
@log_requests
def get_anonymous_identity(topic_id):
    """Get user's anonymous identity for a topic."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
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
        logger.error(f"Get anonymous identity error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get anonymous identity']}), 500


@topics_bp.route('/<topic_id>/anonymous-identity', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_anonymous_identity(topic_id):
    """Update user's anonymous identity for a topic."""
    try:
        data = request.get_json()
        new_name = data.get('new_name', '').strip()

        if not new_name:
            return jsonify({'success': False, 'errors': ['New name is required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        anon_model = AnonymousIdentity(current_app.db)
        success = anon_model.update_anonymous_identity(user_id, topic_id, new_name)

        if success:
            return jsonify({
                'success': True,
                'message': 'Anonymous identity updated successfully',
                'data': {
                    'anonymous_name': new_name,
                    'topic_id': topic_id
                }
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to update anonymous identity']}), 400

    except Exception as e:
        logger.error(f"Update anonymous identity error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to update anonymous identity']}), 500