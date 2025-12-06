from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.comment import Comment
from models.post import Post
from models.topic import Topic
from models.anonymous_identity import AnonymousIdentity
from utils.validators import validate_message_content
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
comments_bp = Blueprint('comments', __name__)


@comments_bp.route('/posts/<post_id>/comments', methods=['GET'])
@log_requests
def get_post_comments(post_id):
    """Get all comments for a post, organized as a tree."""
    try:
        sort_by = request.args.get('sort_by', 'top')  # 'top', 'new', 'old'
        limit = int(request.args.get('limit', 100))

        if limit < 1 or limit > 500:
            limit = 100

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

        comment_model = Comment(current_app.db)
        comments = comment_model.get_comments_by_post(
            post_id=post_id,
            sort_by=sort_by,
            limit=limit,
            user_id=user_id
        )

        return jsonify({
            'success': True,
            'data': comments
        }), 200

    except Exception as e:
        logger.error(f"Get post comments error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get comments: {str(e)}']}), 500


@comments_bp.route('/posts/<post_id>/comments', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_comment(post_id):
    """Create a new comment on a post."""
    try:
        data = request.get_json()
        content = data.get('content', '').strip()
        use_anonymous = data.get('use_anonymous', False)
        gif_url = data.get('gif_url')

        if not content and not gif_url:
            return jsonify({'success': False, 'errors': ['Comment content or GIF URL is required']}), 400

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

        # Verify post exists
        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404

        # Check if user is banned from topic
        topic_model = Topic(current_app.db)
        topic_id = post.get('topic_id')
        if topic_id and topic_model.is_user_banned_from_topic(topic_id, user_id):
            return jsonify({'success': False, 'errors': ['You are banned from this topic']}), 403

        # Handle anonymous identity
        anonymous_identity = None
        if topic_id:
            topic = topic_model.get_topic_by_id(topic_id)
            if use_anonymous and topic and topic.get('settings', {}).get('allow_anonymous', True):
                anon_model = AnonymousIdentity(current_app.db)
                anonymous_identity = anon_model.get_anonymous_identity(user_id, topic_id)

        # Create comment
        comment_model = Comment(current_app.db)
        comment_id = comment_model.create_comment(
            post_id=post_id,
            user_id=user_id,
            content=content if content else '[GIF]',
            anonymous_identity=anonymous_identity,
            gif_url=gif_url
        )

        # Get created comment
        new_comment = comment_model.get_comment_by_id(comment_id)
        if not new_comment:
            return jsonify({'success': False, 'errors': ['Failed to create comment']}), 500

        # Process mentions in comment content
        try:
            from utils.mention_parser import process_mentions_in_content
            post_title = post.get('title', 'Untitled Post')
            process_mentions_in_content(
                db=current_app.db,
                content=content if content else '',
                content_id=comment_id,
                content_type='comment',
                sender_id=user_id,
                context={
                    'post_id': post_id,
                    'post_title': post_title,
                    'topic_id': topic_id
                }
            )
            logger.info(f"Processed mentions in comment {comment_id}")
        except Exception as e:
            logger.warning(f"Failed to process mentions in comment: {str(e)}")

        # Emit socket event
        try:
            from app import socketio
            if socketio:
                room_name = f"post_{post_id}"
                socketio.emit('new_comment', new_comment, room=room_name)
                logger.info(f"Emitted new_comment event to room {room_name} for comment {comment_id}")
        except Exception as e:
            logger.warning(f"Failed to emit socket event for comment {comment_id}: {str(e)}")

        # Notify post followers about new comment
        try:
            from models.notification_settings import NotificationSettings
            from models.notification import Notification
            
            notification_settings = NotificationSettings(current_app.db)
            notification_model = Notification(current_app.db)
            
            # Get all followers of this post
            followers = notification_settings.get_post_followers(post_id)
            
            # Get post title for notification
            post_title = post.get('title', 'Untitled Post')
            
            # Get topic to check if muted
            topic_id = post.get('topic_id')
            
            # Notify each follower (except the comment author)
            for follower_id in followers:
                if follower_id == user_id:
                    continue  # Don't notify the comment author
                
                # Check if topic is muted FIRST (topic silencing overrides everything)
                if topic_id and notification_settings.is_topic_muted(follower_id, topic_id):
                    logger.info(f"Skipping notification for follower {follower_id} - topic {topic_id} is muted")
                    continue
                
                # Verify user is still following the post (should be true since we got them from get_post_followers, but double-check)
                if not notification_settings.is_following_post(follower_id, post_id):
                    logger.info(f"Skipping notification for follower {follower_id} - post {post_id} is not followed")
                    continue
                
                # Get commenter username
                commenter_username = new_comment.get('author_username', 'Anonymous')
                if not commenter_username or commenter_username == 'Anonymous':
                    from models.user import User
                    user_model = User(current_app.db)
                    commenter = user_model.get_user_by_id(user_id)
                    if commenter:
                        commenter_username = commenter.get('username', 'Unknown')
                
                # Create notification
                notification_id = notification_model.create_notification(
                    user_id=follower_id,
                    notification_type='comment',
                    title='New comment',
                    message=f'New comment on "{post_title}"',
                    data={
                        'post_id': post_id,
                        'post_title': post_title,
                        'comment_id': comment_id,
                        'commenter_id': user_id,
                        'commenter_username': commenter_username,
                        'topic_id': topic_id
                    },
                    sender_id=user_id,
                    context_id=post_id,
                    context_type='post'
                )
                
                # Emit real-time notification via socket
                if notification_id:
                    try:
                        from app import socketio
                        if socketio:
                            user_room = f"user_{follower_id}"
                            socketio.emit('new_notification', {
                                'id': notification_id,
                                'type': 'comment',
                                'title': 'New comment',
                                'message': f'New comment on "{post_title}"',
                                'data': {
                                    'post_id': post_id,
                                    'post_title': post_title,
                                    'comment_id': comment_id,
                                    'commenter_username': commenter_username
                                },
                                'sender_username': commenter_username,
                                'context_id': post_id,
                                'context_type': 'post',
                                'context_name': post_title,
                                'timestamp': new_comment.get('created_at')
                            }, room=user_room)
                            logger.info(f"Emitted new_notification for comment to user {follower_id}")
                    except Exception as e:
                        logger.warning(f"Failed to emit notification socket event: {str(e)}")
        except Exception as e:
            logger.warning(f"Failed to notify post followers: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Comment created successfully',
            'data': new_comment
        }), 201

    except Exception as e:
        logger.error(f"Create comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create comment: {str(e)}']}), 500


@comments_bp.route('/<comment_id>/reply', methods=['POST'])
@require_json
@require_auth()
@log_requests
def reply_to_comment(comment_id):
    """Create a reply to a comment (subcomment)."""
    try:
        data = request.get_json()
        content = data.get('content', '').strip()
        use_anonymous = data.get('use_anonymous', False)
        gif_url = data.get('gif_url')

        if not content and not gif_url:
            return jsonify({'success': False, 'errors': ['Reply content or GIF URL is required']}), 400

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

        # Get parent comment to find post
        comment_model = Comment(current_app.db)
        parent_comment = comment_model.get_comment_by_id(comment_id)
        if not parent_comment:
            return jsonify({'success': False, 'errors': ['Parent comment not found']}), 404

        post_id = parent_comment['post_id']

        # Verify post exists and check permissions
        post_model = Post(current_app.db)
        post = post_model.get_post_by_id(post_id)
        if not post:
            return jsonify({'success': False, 'errors': ['Post not found']}), 404

        # Check if user is banned from topic
        topic_model = Topic(current_app.db)
        topic_id = post.get('topic_id')
        if topic_id and topic_model.is_user_banned_from_topic(topic_id, user_id):
            return jsonify({'success': False, 'errors': ['You are banned from this topic']}), 403

        # Handle anonymous identity
        anonymous_identity = None
        if topic_id:
            topic = topic_model.get_topic_by_id(topic_id)
            if use_anonymous and topic and topic.get('settings', {}).get('allow_anonymous', True):
                anon_model = AnonymousIdentity(current_app.db)
                anonymous_identity = anon_model.get_anonymous_identity(user_id, topic_id)

        # Create reply
        reply_id = comment_model.create_comment(
            post_id=post_id,
            user_id=user_id,
            content=content if content else '[GIF]',
            parent_comment_id=comment_id,
            anonymous_identity=anonymous_identity,
            gif_url=gif_url
        )

        # Get created reply
        new_reply = comment_model.get_comment_by_id(reply_id)
        if not new_reply:
            return jsonify({'success': False, 'errors': ['Failed to create reply']}), 500

        # Emit socket event
        try:
            from app import socketio
            if socketio:
                room_name = f"post_{post_id}"
                socketio.emit('new_comment', new_reply, room=room_name)
                logger.info(f"Emitted new_comment event to room {room_name} for reply {reply_id}")
        except Exception as e:
            logger.warning(f"Failed to emit socket event for reply {reply_id}: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Reply created successfully',
            'data': new_reply
        }), 201

    except Exception as e:
        logger.error(f"Create reply error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to create reply: {str(e)}']}), 500


@comments_bp.route('/<comment_id>', methods=['GET'])
@log_requests
def get_comment(comment_id):
    """Get a specific comment by ID."""
    try:
        comment_model = Comment(current_app.db)

        comment = comment_model.get_comment_by_id(comment_id)
        if not comment:
            return jsonify({'success': False, 'errors': ['Comment not found']}), 404

        return jsonify({
            'success': True,
            'data': comment
        }), 200

    except Exception as e:
        logger.error(f"Get comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get comment: {str(e)}']}), 500


@comments_bp.route('/<comment_id>/upvote', methods=['POST'])
@require_auth()
@log_requests
def upvote_comment(comment_id):
    """Upvote or remove upvote from a comment."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        comment_model = Comment(current_app.db)
        success = comment_model.upvote_comment(comment_id, user_id)

        if success:
            # Get updated comment with user vote status
            updated_comment = comment_model.get_comment_by_id(comment_id, user_id)
            
            # Emit socket event
            try:
                from app import socketio
                if socketio and updated_comment:
                    room_name = f"post_{updated_comment['post_id']}"
                    socketio.emit('comment_upvoted', {
                        'comment_id': comment_id,
                        'user_id': user_id,
                        'upvote_count': updated_comment.get('upvote_count', 0),
                        'user_has_upvoted': updated_comment.get('user_has_upvoted', False)
                    }, room=room_name)
            except Exception as e:
                logger.warning(f"Failed to emit socket event: {str(e)}")

            return jsonify({
                'success': True,
                'message': 'Comment upvoted successfully',
                'data': updated_comment
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to upvote comment']}), 400

    except Exception as e:
        logger.error(f"Upvote comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to upvote comment: {str(e)}']}), 500


@comments_bp.route('/<comment_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_comment(comment_id):
    """Delete a comment (moderator, owner, or comment author)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        comment_model = Comment(current_app.db)
        success = comment_model.delete_comment(comment_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Comment deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Permission denied or comment not found']}), 403

    except Exception as e:
        logger.error(f"Delete comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to delete comment: {str(e)}']}), 500


@comments_bp.route('/<comment_id>/downvote', methods=['POST'])
@require_auth()
@log_requests
def downvote_comment(comment_id):
    """Downvote or remove downvote from a comment."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        comment_model = Comment(current_app.db)
        success = comment_model.downvote_comment(comment_id, user_id)

        if success:
            # Get updated comment with user vote status
            updated_comment = comment_model.get_comment_by_id(comment_id, user_id)

            # Emit socket event
            try:
                from app import socketio
                if socketio and updated_comment:
                    room_name = f"post_{updated_comment['post_id']}"
                    socketio.emit('comment_downvoted', {
                        'comment_id': comment_id,
                        'user_id': user_id,
                        'downvote_count': updated_comment.get('downvote_count', 0),
                        'user_has_downvoted': updated_comment.get('user_has_downvoted', False)
                    }, room=room_name)
            except Exception as e:
                logger.warning(f"Failed to emit socket event: {str(e)}")

            return jsonify({
                'success': True,
                'message': 'Comment downvoted successfully',
                'data': updated_comment
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to downvote comment']}), 400

    except Exception as e:
        logger.error(f"Downvote comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to downvote comment: {str(e)}']}), 500


@comments_bp.route('/<comment_id>/report', methods=['POST'])
@require_json
@require_auth()
@log_requests
def report_comment(comment_id):
    """Report a comment for moderation."""
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

        comment_model = Comment(current_app.db)
        comment = comment_model.get_comment_by_id(comment_id)
        if not comment:
            return jsonify({'success': False, 'errors': ['Comment not found']}), 404

        success = comment_model.report_comment(comment_id, user_id, reason)

        if success:
            return jsonify({
                'success': True,
                'message': 'Comment reported successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to report comment or already reported']}), 400

    except Exception as e:
        logger.error(f"Report comment error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to report comment: {str(e)}']}), 500





