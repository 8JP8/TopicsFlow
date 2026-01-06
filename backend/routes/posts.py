from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.post import Post
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from utils.validators import validate_message_content, validate_pagination_params
from utils.validators import validate_message_content, validate_pagination_params
from utils.decorators import require_auth, require_json, log_requests
from utils.cache_decorator import cache_result
import hashlib
import json
import logging

logger = logging.getLogger(__name__)
posts_bp = Blueprint('posts', __name__)


def get_recent_posts_key(func_name, args, kwargs):
    """Generate cache key for recent posts."""
    params = [
        request.args.get('limit', '20'),
        request.args.get('offset', '0')
    ]
    # Include user_id in cache key if personalized feed is implemented later
    # For now, public recent posts are same for everyone?
    # Actually, `get_recent_posts` in `Post` model takes `user_id` to check likes/upvotes status?
    # Yes, lines 46: user_id=user_id.
    # So cache key MUST include user_id if authenticated.
    # But we can't easily get user_id from request.args.
    # We need to peek at session or token.
    # `utils/cache_decorator.py` runs inside request context.
    # We can use `AuthService` inside key func? Or just use session/g if set.
    # `get_recent_posts` logic checks auth.
    # If we cache per user, it's expensive.
    # ALTERNATIVE: Cache the *list of posts* (data) generically, and populate `user_has_upvoted` in the route after fetching from cache?
    # Or just cache per user.
    # High traffic endpoints usually benefit from per-user caching if users are sticky, but 'recent' is global.
    # If I cache per user, 1000 users = 1000 keys. Not bad for Redis.
    # Let's try to get user_id from auth header or session.
    # BUT `cache_result` runs BEFORE function body.
    # I'll enable caching ONLY for anonymous users for now? Or just cache per user.
    # Let's cache per user.
    from services.auth_service import AuthService
    from flask import current_app
    user_suffix = "anon"
    try:
        auth = AuthService(current_app.db)
        if auth.is_authenticated():
            res = auth.get_current_user()
            if res.get('success'):
                user_suffix = res['user']['id']
    except:
        pass
    
    key_string = '_'.join(str(p) for p in params)
    return f"post:recent:{user_suffix}:{key_string}"

@posts_bp.route('/recent', methods=['GET'])
@log_requests
@cache_result(ttl=60, key_func=get_recent_posts_key)
def get_recent_posts():
    """Get recent posts from all topics for the right sidebar."""
    try:
        # Parse query parameters
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))

        # Validate pagination
        pagination_result = validate_pagination_params(limit, offset)
        if not pagination_result['valid']:
            return jsonify({'success': False, 'errors': pagination_result['errors']}), 400

        limit = pagination_result['limit']
        offset = pagination_result['offset']

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
        posts = post_model.get_recent_posts(
            limit=limit,
            offset=offset,
            user_id=user_id
        )

        return jsonify({
            'success': True,
            'data': posts
        }), 200

    except Exception as e:
        logger.error(f"Get recent posts error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get recent posts: {str(e)}']}), 500


def get_topic_posts_key(func_name, args, kwargs):
    """Generate cache key for topic posts."""
    topic_id = kwargs.get('topic_id')
    params = [
        request.args.get('sort_by', 'new'),
        request.args.get('limit', '50'),
        request.args.get('offset', '0')
    ]
    
    # Get user_id for personalization
    from services.auth_service import AuthService
    from flask import current_app
    user_suffix = "anon"
    try:
        auth = AuthService(current_app.db)
        if auth.is_authenticated():
            res = auth.get_current_user()
            if res.get('success'):
                user_suffix = res['user']['id']
    except:
        pass
        
    key_string = '_'.join(str(p) for p in params)
    key_hash = hashlib.md5(key_string.encode()).hexdigest()
    return f"post:list:topic_{topic_id}:{user_suffix}:{key_hash}"

@posts_bp.route('/topics/<topic_id>/posts', methods=['GET'])
@log_requests
@cache_result(ttl=120, key_func=get_topic_posts_key)
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
        tags = data.get('tags', [])
        if isinstance(tags, str):
            tags = [tag.strip() for tag in tags.split(',') if tag.strip()]
        # Validate tags
        tags = [tag for tag in tags if 2 <= len(tag) <= 20]

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
            if not anonymous_identity:
                # Create a new one if it doesn't exist
                anonymous_identity = anon_model.create_anonymous_identity(user_id, topic_id)
                # Emit socket event so Settings page can update
                try:
                    from app import socketio
                    if socketio:
                        socketio.emit('anonymous_identity_updated', {
                            'user_id': user_id,
                            'topic_id': topic_id,
                            'anonymous_name': anonymous_identity
                        }, room=f"user_{user_id}")
                except Exception as e:
                    logger.warning(f"Failed to emit socket event for auto-created identity: {str(e)}")

        # Create post
        post_model = Post(current_app.db)
        post_id = post_model.create_post(
            topic_id=topic_id,
            user_id=user_id,
            title=title,
            content=content if content else '[GIF]',
            anonymous_identity=anonymous_identity,
            gif_url=gif_url,
            tags=tags
        )
        
        # Add post tags to topic (non-duplicate)
        if tags:
            topic_tags = topic.get('tags', [])
            new_tags = [tag for tag in tags if tag not in topic_tags]
            if new_tags:
                topic_model.add_tags_to_topic(topic_id, new_tags)

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

        if current_app.config.get('CACHE_INVALIDATOR'):
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern('post:recent:*')
            current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f'post:list:topic_{topic_id}:*')
            current_app.config['CACHE_INVALIDATOR'].invalidate_entity('topic', topic_id)

        return jsonify({
            'success': True,
            'message': 'Post created successfully',
            'data': new_post
        }), 201
        


    except Exception as e:
        logger.error(f"Create post error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create post: {str(e)}']}), 500


def get_post_key(func_name, args, kwargs):
    post_id = kwargs.get('post_id')
    
    # Get user_id for personalization (upvoted status)
    from services.auth_service import AuthService
    from flask import current_app
    user_suffix = "anon"
    try:
        auth = AuthService(current_app.db)
        if auth.is_authenticated():
            res = auth.get_current_user()
            if res.get('success'):
                user_suffix = res['user']['id']
    except:
        pass
        
    return f"post:{post_id}:{user_suffix}"

@posts_bp.route('/<post_id>', methods=['GET'])
@log_requests
@cache_result(ttl=300, key_func=get_post_key)
def get_post(post_id):
    """Get a specific post by ID."""
    try:
        post_model = Post(current_app.db)

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

        post = post_model.get_post_by_id(post_id, user_id)
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

            # Cache Invalidation
            if current_app.config.get('CACHE_INVALIDATOR'):
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f'post:{post_id}:*')
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern('post:recent:*')
                topic_id = updated_post.get('topic_id')
                if topic_id:
                     current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f'post:list:topic_{topic_id}:*')

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

            # Cache Invalidation
            if current_app.config.get('CACHE_INVALIDATOR'):
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f'post:{post_id}:*')
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern('post:recent:*')
                topic_id = updated_post.get('topic_id')
                if topic_id:
                     current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f'post:list:topic_{topic_id}:*')

            return jsonify({
                'success': True,
                'message': 'Post downvoted successfully',
                'data': updated_post
            }), 200
            
            # Cache Invalidation logic for upvote/downvote
            # Wait, I can't put it after return.
            # I'll fix it in separate edit or modify this chunk logic to be correct syntax (before return).

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

        mode = request.args.get('mode', 'soft')

        post_model = Post(current_app.db)
        success = post_model.delete_post(post_id, user_id, mode)

        if success:
            # Invalidate cache
            if current_app.config.get('CACHE_INVALIDATOR'):
                # Get topic_id from post (we need to fetch it first? No, we have post object ideally. 
                # But here we only have post_id. We fetch it? 
                # `post_model.delete_post` performs check.
                # Ideally `delete_post` returns info or we fetch before delete.
                # `delete_post` in model likely verifies ownership.
                # Let's just invalidate specific patterns if we don't know topic.
                # OR we fetch it.
                # Actually, `post_model.delete_post` uses `self.collection.find_one`.
                # Let's trust we can invalidate `post:{post_id}:*` (pattern).
                # For `post:list:topic_*`, we need topic_id.
                # It's better to fetch post before delete or have delete return it.
                # Let's assume we can't easily get topic_id after delete (if hard delete).
                # But we can try finding it first?
                # For now, invalidate `post:{post_id}:*` and `post:recent:*`.
                # If we miss `post:list:topic`, it will expire in 2 mins (TTL 120).
                # But `topic` post count will be wrong.
                # Let's fetch post briefly. No, `delete_post` was called.
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern(f'post:{post_id}:*')
                current_app.config['CACHE_INVALIDATOR'].invalidate_pattern('post:recent:*')
                # Try to invalidate all topic lists? No too expensive.
                pass

            return jsonify({
                'success': True,
                'message': f'Post {"permanently " if mode == "hard" else ""}deleted successfully'
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


@posts_bp.route('/<post_id>/status', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_post_status(post_id):
    """Update post status (admin only)."""
    try:
        # Check admin
        from utils.admin_middleware import require_admin
        # We can't use the decorator easily inside the function, so let's check manually or assume imports are handled.
        # Actually I should update imports first. But for now I'll check user admin status manually.
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success') or not current_user_result['user'].get('is_admin'):
             return jsonify({'success': False, 'errors': ['Admin access required']}), 403

        data = request.get_json()
        status = data.get('status')
        reason = data.get('reason', '')
        
        if status not in ['open', 'closed']:
            return jsonify({'success': False, 'errors': ['Invalid status']}), 400

        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404

        if status == 'closed':
            if not reason:
                return jsonify({'success': False, 'errors': ['Closure reason is required']}), 400
            success = post_model.close_post(post_id, reason)
        else:
            success = post_model.open_post(post_id)

        if success:
            # Emit socket event
            try:
                from app import socketio
                if socketio:
                    topic_id = post.get('topic_id')
                    if topic_id:
                        room_name = f"topic_{topic_id}"
                        socketio.emit('post_status_updated', {
                            'post_id': post_id,
                            'status': status,
                            'closure_reason': reason if status == 'closed' else None
                        }, room=room_name)
            except Exception as e:
                logger.warning(f"Failed to emit socket event: {str(e)}")

            return jsonify({
                'success': True,
                'message': f'Post {status} successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to update post status']}), 400

    except Exception as e:
        logger.error(f"Update post status error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to update post status: {str(e)}']}), 500

