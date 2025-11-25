from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.post import Post
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from utils.validators import validate_message_content, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
posts_bp = Blueprint('posts', __name__)


@posts_bp.route('/topics/<topic_id>/posts', methods=['GET'])
@log_requests
def get_topic_posts(topic_id):
    """Get posts for a topic with sorting and pagination."""
    try:
        # Validate topic_id
        if not topic_id or topic_id == 'undefined' or topic_id == 'null':
            return jsonify({'success': False, 'errors': ['Topic ID is required']}), 400
        
        # Parse query parameters
        sort_by = request.args.get('sort_by', 'new')  # 'new', 'hot', 'top', 'old'
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        # Validate pagination
        pagination_result = validate_pagination_params(limit, offset)
        if not pagination_result['valid']:
            return jsonify({'success': False, 'errors': pagination_result['errors']}), 400

        limit = pagination_result['limit']
        offset = pagination_result['offset']

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

        post_model = Post(current_app.db)
        posts = post_model.get_posts_by_topic(
            topic_id=topic_id,
            sort_by=sort_by,
            limit=limit,
            offset=offset,
            user_id=user_id
        )

        return jsonify({
            'success': True,
            'data': posts
        }), 200

    except Exception as e:
        logger.error(f"Get topic posts error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get posts: {str(e)}']}), 500


@posts_bp.route('/topics/<topic_id>/posts', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_post(topic_id):
    """Create a new post in a topic."""
    try:
        # Validate topic_id
        if not topic_id or topic_id == 'undefined' or topic_id == 'null':
            return jsonify({'success': False, 'errors': ['Topic ID is required']}), 400
        
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        use_anonymous = data.get('use_anonymous', False)
        gif_url = data.get('gif_url')

        if not title:
            return jsonify({'success': False, 'errors': ['Post title is required']}), 400

        if not content and not gif_url:
            return jsonify({'success': False, 'errors': ['Post content or GIF URL is required']}), 400

        if len(title) > 300:
            return jsonify({'success': False, 'errors': ['Title must be 300 characters or less']}), 400

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

        # Verify topic exists and user has access
        topic_model = Topic(current_app.db)
        try:
            topic = topic_model.get_topic_by_id(topic_id)
        except Exception as e:
            logger.error(f"Invalid topic_id format: {topic_id}, error: {str(e)}")
            return jsonify({'success': False, 'errors': ['Invalid topic ID format']}), 400

        if not topic:
            return jsonify({'success': False, 'errors': ['Topic not found']}), 404

        # Check if user is banned from topic
        if topic_model.is_user_banned_from_topic(topic_id, user_id):
            return jsonify({'success': False, 'errors': ['You are banned from this topic']}), 403

        # Handle anonymous identity
        anonymous_identity = None
        if use_anonymous and topic.get('settings', {}).get('allow_anonymous', True):
            anon_model = AnonymousIdentity(current_app.db)
            anonymous_identity = anon_model.get_anonymous_identity(user_id, topic_id)

        # Create post
        post_model = Post(current_app.db)
        post_id = post_model.create_post(
            topic_id=topic_id,
            user_id=user_id,
            title=title,
            content=content if content else '[GIF]',
            anonymous_identity=anonymous_identity,
            gif_url=gif_url
        )

        # Get created post
        new_post = post_model.get_post_by_id(post_id)
        if not new_post:
            return jsonify({'success': False, 'errors': ['Failed to create post']}), 500

        # Emit socket event
        try:
            from app import socketio
            if socketio:
                room_name = f"topic_{topic_id}"
                socketio.emit('new_post', new_post, room=room_name)
                logger.info(f"Emitted new_post event to room {room_name} for post {post_id}")
        except Exception as e:
            logger.warning(f"Failed to emit socket event for post {post_id}: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Post created successfully',
            'data': new_post
        }), 201

    except Exception as e:
        logger.error(f"Create post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create post: {str(e)}']}), 500


@posts_bp.route('/<post_id>', methods=['GET'])
@log_requests
def get_post(post_id):
    """Get a specific post by ID."""
    try:
        post_model = Post(current_app.db)

        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404

        return jsonify({
            'success': True,
            'data': post
        }), 200

    except Exception as e:
        logger.error(f"Get post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get post: {str(e)}']}), 500


@posts_bp.route('/<post_id>/upvote', methods=['POST'])
@require_auth()
@log_requests
def upvote_post(post_id):
    """Upvote or remove upvote from a post."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        post_model = Post(current_app.db)
        success = post_model.upvote_post(post_id, user_id)

        if success:
            # Get updated post
            updated_post = post_model.get_post_by_id(post_id)
            
            # Emit socket event
            try:
                from app import socketio
                if socketio and updated_post:
                    topic_id = updated_post.get('topic_id')
                    if topic_id:
                        room_name = f"topic_{topic_id}"
                        socketio.emit('post_upvoted', {
                            'post_id': post_id,
                            'user_id': user_id,
                            'upvote_count': updated_post.get('upvote_count', 0),
                            'downvote_count': updated_post.get('downvote_count', 0),
                            'score': updated_post.get('score', 0),
                            'user_has_upvoted': updated_post.get('user_has_upvoted', False),
                            'user_has_downvoted': updated_post.get('user_has_downvoted', False)
                        }, room=room_name)
            except Exception as e:
                logger.warning(f"Failed to emit socket event: {str(e)}")

            return jsonify({
                'success': True,
                'message': 'Post upvoted successfully',
                'data': updated_post
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to upvote post']}), 400

    except Exception as e:
        logger.error(f"Upvote post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to upvote post: {str(e)}']}), 500


@posts_bp.route('/<post_id>/downvote', methods=['POST'])
@require_auth()
@log_requests
def downvote_post(post_id):
    """Downvote or remove downvote from a post."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        post_model = Post(current_app.db)
        success = post_model.downvote_post(post_id, user_id)

        if success:
            # Get updated post
            updated_post = post_model.get_post_by_id(post_id)
            
            # Emit socket event
            try:
                from app import socketio
                if socketio and updated_post:
                    topic_id = updated_post.get('topic_id')
                    if topic_id:
                        room_name = f"topic_{topic_id}"
                        socketio.emit('post_downvoted', {
                            'post_id': post_id,
                            'user_id': user_id,
                            'upvote_count': updated_post.get('upvote_count', 0),
                            'downvote_count': updated_post.get('downvote_count', 0),
                            'score': updated_post.get('score', 0),
                            'user_has_upvoted': updated_post.get('user_has_upvoted', False),
                            'user_has_downvoted': updated_post.get('user_has_downvoted', False)
                        }, room=room_name)
            except Exception as e:
                logger.warning(f"Failed to emit socket event: {str(e)}")

            return jsonify({
                'success': True,
                'message': 'Post downvoted successfully',
                'data': updated_post
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to downvote post']}), 400

    except Exception as e:
        logger.error(f"Downvote post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to downvote post: {str(e)}']}), 500


@posts_bp.route('/<post_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_post(post_id):
    """Delete a post (moderator, owner, or post author)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        post_model = Post(current_app.db)
        success = post_model.delete_post(post_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Post deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or post not found']}), 403

    except Exception as e:
        logger.error(f"Delete post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to delete post: {str(e)}']}), 500


@posts_bp.route('/<post_id>/report', methods=['POST'])
@require_json
@require_auth()
@log_requests
def report_post(post_id):
    """Report a post for moderation."""
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

        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404

        success = post_model.report_post(post_id, user_id, reason)

        if success:
            return jsonify({
                'success': True,
                'message': 'Post reported successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to report post or already reported']}), 400

    except Exception as e:
        logger.error(f"Report post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to report post: {str(e)}']}), 500

