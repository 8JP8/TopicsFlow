from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.report import Report
from models.topic import Topic
from models.user import User
from utils.validators import validate_pagination_params, validate_report_reason
from utils.decorators import require_auth, require_json, log_requests
from utils.cache_decorator import cache_result, user_cache_key
import logging

logger = logging.getLogger(__name__)
reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_report():
    """Create a new report for content or user."""
    try:
        data = request.get_json()
        reason = data.get('reason', '').strip()
        description = data.get('description', '').strip()
        content_type = data.get('content_type', 'message')
        content_id = data.get('content_id')
        reported_user_id = data.get('reported_user_id')
        topic_id = data.get('topic_id')
        attach_current_message = data.get('attach_current_message', False)
        attach_message_history = data.get('attach_message_history', False)
        current_message_id = data.get('current_message_id')
        chat_room_id = data.get('chat_room_id')
        owner_id = data.get('owner_id')
        owner_username = data.get('owner_username')
        moderators = data.get('moderators', [])

        # Validate reason
        if not reason:
            return jsonify({'success': False, 'errors': ['Reason is required']}), 400

        # Validate description
        if not description or len(description) < 10:
            return jsonify({'success': False, 'errors': ['Description must be at least 10 characters']}), 400
        if len(description) > 1000:
            return jsonify({'success': False, 'errors': ['Description must be less than 1000 characters']}), 400

        # Validate that either content_id or reported_user_id is provided
        # Exception: chatroom reports don't need reported_user_id
        if not content_id and not reported_user_id and content_type not in ['chatroom', 'chatroom_background', 'chatroom_picture']:
            return jsonify({'success': False, 'errors': ['Either content_id or reported_user_id is required']}), 400

        # Get current user
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        reporter_id = current_user_result['user']['id']

        # Prevent reporting yourself
        # Check direct user report
        if reported_user_id and reported_user_id == reporter_id:
            return jsonify({'success': False, 'errors': ['Cannot report yourself']}), 400
        
        # Check content reports - verify if reporter is the author of the content
        if content_id and not reported_user_id:
            content_id_str = str(content_id)
            if content_type == 'message':
                from models.message import Message
                message_model = Message(current_app.db)
                message = message_model.get_message_by_id(content_id_str)
                if message and message.get('user_id'):
                    message_user_id = str(message.get('user_id'))
                    if message_user_id == reporter_id:
                        return jsonify({'success': False, 'errors': ['Cannot report your own message']}), 400
            elif content_type == 'post':
                from models.post import Post
                post_model = Post(current_app.db)
                post = post_model.get_post_by_id(content_id_str)
                if post and post.get('user_id'):
                    post_user_id = str(post.get('user_id'))
                    if post_user_id == reporter_id:
                        return jsonify({'success': False, 'errors': ['Cannot report your own post']}), 400
            elif content_type == 'comment':
                from models.comment import Comment
                comment_model = Comment(current_app.db)
                comment = comment_model.get_comment_by_id(content_id_str)
                if comment and comment.get('user_id'):
                    comment_user_id = str(comment.get('user_id'))
                    if comment_user_id == reporter_id:
                        return jsonify({'success': False, 'errors': ['Cannot report your own comment']}), 400

        # For chatroom reports, fetch owner and moderators if not provided
        if content_type in ['chatroom', 'chatroom_background', 'chatroom_picture'] and content_id:
            if not owner_id or not moderators:
                from models.chat_room import ChatRoom
                chat_room_model = ChatRoom(current_app.db)
                chatroom = chat_room_model.get_chat_room_by_id(content_id)
                if chatroom:
                    if not owner_id:
                        owner_id = chatroom.get('owner_id')
                        owner_username = chatroom.get('owner', {}).get('username')
                    if not moderators:
                        # Get moderator details
                        from models.user import User
                        user_model = User(current_app.db)
                        moderators = []
                        for mod_id in chatroom.get('moderators', []):
                            mod_user = user_model.get_user_by_id(str(mod_id))
                            if mod_user:
                                moderators.append({
                                    'id': str(mod_user['_id']),
                                    'username': mod_user['username']
                                })

        # Create report
        report_model = Report(current_app.db)
        report_id = report_model.create_report(
            reporter_id=reporter_id,
            reason=reason,
            description=description,
            content_type=content_type,
            content_id=content_id,
            reported_user_id=reported_user_id,
            topic_id=topic_id,
            attach_current_message=attach_current_message,
            attach_message_history=attach_message_history,
            current_message_id=current_message_id,
            chat_room_id=chat_room_id,
            owner_id=owner_id,
            owner_username=owner_username,
            moderators=moderators
        )
        
        # Emit admin notification
        try:
            from socketio_handlers import emit_admin_notification
            socketio = current_app.extensions.get('socketio') if current_app.extensions else None
            
            # Use safe socketio access
            if socketio and isinstance(socketio, dict):
                 socketio = socketio.get('socketio')

            if socketio:
                emit_admin_notification(socketio, 'new_report', {
                    'report_id': str(report_id),
                    'reporter_id': reporter_id,
                    'reason': reason[:100]  # First 100 chars
                })
        except Exception as e:
            logger.warning(f"Failed to emit admin notification: {str(e)}")

        # Invalidate caches
        try:
            current_app.config['CACHE_INVALIDATOR'].invalidate_user_reports(reporter_id)
            current_app.config['CACHE_INVALIDATOR'].invalidate_admin_reports()
        except Exception as e:
            logger.error(f"Cache invalidation failed: {e}")

        return jsonify({
            'success': True,
            'message': 'Report submitted successfully',
            'data': {
                'report_id': report_id
            }
        }), 201

    except ValueError as e:
        return jsonify({'success': False, 'errors': [str(e)]}), 400
    except Exception as e:
        logger.error(f"Create report error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to create report']}), 500


@reports_bp.route('/my-reports', methods=['GET'])
@require_auth()
@cache_result(ttl=300, key_prefix='reports', key_func=user_cache_key('reports'))
@log_requests
def get_my_reports():
    """Get reports submitted by current user."""
    try:
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))

        if limit < 1 or limit > 50:
            limit = 20
        if offset < 0:
            offset = 0

        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)
        reports = report_model.get_user_reports(user_id, as_reporter=True)

        # Apply pagination
        total_count = len(reports)
        reports = reports[offset:offset + limit]

        return jsonify({
            'success': True,
            'data': reports,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total_count,
                'has_more': offset + limit < total_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get my reports error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get reports']}), 500


@reports_bp.route('/', methods=['GET'])
@require_auth()
@cache_result(ttl=60, key_prefix='reports:list', key_func=user_cache_key('reports:list'))
@log_requests
def get_reports():
    """Get reports with filtering and pagination."""
    try:
        # Parse query parameters
        status = request.args.get('status', 'pending')
        topic_id = request.args.get('topic_id')
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))

        # Validate status
        valid_statuses = ['pending', 'reviewed', 'resolved', 'dismissed']
        if status not in valid_statuses:
            status = 'pending'

        # Validate pagination
        pagination_result = validate_pagination_params(limit, offset)
        if not pagination_result['valid']:
            return jsonify({'success': False, 'errors': pagination_result['errors']}), 400

        limit = pagination_result['limit']
        offset = pagination_result['offset']

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)

        # Get reports
        reports = report_model.get_pending_reports(
            topic_id=topic_id,
            limit=limit,
            offset=offset
        ) if status == 'pending' else report_model.get_reports_by_status(
            status=status,
            topic_id=topic_id
        )

        # Apply pagination for non-pending reports
        if status != 'pending':
            reports = reports[offset:offset + limit]

        # Filter reports based on user permissions
        filtered_reports = []
        for report in reports:
            # Check if user has permission to view this report
            if can_user_view_report(report, user_id, current_app.db):
                filtered_reports.append(report)

        return jsonify({
            'success': True,
            'data': filtered_reports,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total_count': len(filtered_reports),
                'has_more': len(filtered_reports) == limit
            }
        }), 200

    except Exception as e:
        logger.error(f"Get reports error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get reports']}), 500


@reports_bp.route('/<report_id>', methods=['GET'])
@require_auth()
@log_requests
def get_report(report_id):
    """Get a specific report by ID."""
    try:
        from flask import current_app
        report_model = Report(current_app.db)

        report = report_model.get_report_by_id(report_id)
        if not report:
            return jsonify({'success': False, 'errors': ['Report not found']}), 404

        # Check if user has permission to view this report
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        if not can_user_view_report(report, user_id, current_app.db):
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        return jsonify({
            'success': True,
            'data': report
        }), 200

    except Exception as e:
        logger.error(f"Get report error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get report']}), 500


@reports_bp.route('/<report_id>/review', methods=['POST'])
@require_json
@require_auth()
@log_requests
def review_report(report_id):
    """Review and resolve a report."""
    try:
        data = request.get_json()
        action_taken = data.get('action_taken')
        moderator_notes = data.get('moderator_notes', '').strip()

        valid_actions = ['deleted', 'user_banned', 'user_warned', 'dismissed', 'escalated']
        if action_taken not in valid_actions:
            return jsonify({'success': False, 'errors': ['Invalid action']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)

        # Get report to check permissions
        report = report_model.get_report_by_id(report_id)
        if not report:
            return jsonify({'success': False, 'errors': ['Report not found']}), 404

        # Check if user has permission to review this report
        if not can_user_review_report(report, user_id, current_app.db):
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        # Review report
        success = report_model.review_report(
            report_id=report_id,
            reviewer_id=user_id,
            action_taken=action_taken,
            moderator_notes=moderator_notes
        )

        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_admin_reports()
                # Invalidate reporter's cache
                if report.get('reported_by'):
                    current_app.config['CACHE_INVALIDATOR'].invalidate_user_reports(str(report['reported_by']))
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Report reviewed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to review report']}), 400

    except Exception as e:
        logger.error(f"Review report error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to review report']}), 500


@reports_bp.route('/<report_id>/dismiss', methods=['POST'])
@require_json
@require_auth()
@log_requests
def dismiss_report(report_id):
    """Dismiss a report as false positive."""
    try:
        data = request.get_json()
        reason = data.get('reason', '').strip()

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)

        # Get report to check permissions
        report = report_model.get_report_by_id(report_id)
        if not report:
            return jsonify({'success': False, 'errors': ['Report not found']}), 404

        # Check if user has permission to dismiss this report
        if not can_user_review_report(report, user_id, current_app.db):
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        # Dismiss report
        success = report_model.dismiss_report(report_id, user_id, reason)

        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_admin_reports()
                if report.get('reported_by'):
                    current_app.config['CACHE_INVALIDATOR'].invalidate_user_reports(str(report['reported_by']))
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Report dismissed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to dismiss report']}), 400

    except Exception as e:
        logger.error(f"Dismiss report error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to dismiss report']}), 500


@reports_bp.route('/<report_id>/escalate', methods=['POST'])
@require_json
@require_auth()
@log_requests
def escalate_report(report_id):
    """Escalate a report for higher level review."""
    try:
        data = request.get_json()
        reason = data.get('reason', '').strip()

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)

        # Get report to check permissions
        report = report_model.get_report_by_id(report_id)
        if not report:
            return jsonify({'success': False, 'errors': ['Report not found']}), 404

        # Check if user has permission to escalate this report
        if not can_user_review_report(report, user_id, current_app.db):
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        # Escalate report
        success = report_model.escalate_report(report_id, user_id, reason)

        if success:
            try:
                current_app.config['CACHE_INVALIDATOR'].invalidate_admin_reports()
                if report.get('reported_by'):
                    current_app.config['CACHE_INVALIDATOR'].invalidate_user_reports(str(report['reported_by']))
            except Exception as e:
                logger.error(f"Cache invalidation failed: {e}")

            return jsonify({
                'success': True,
                'message': 'Report escalated successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to escalate report']}), 400

    except Exception as e:
        logger.error(f"Escalate report error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to escalate report']}), 500


@reports_bp.route('/statistics', methods=['GET'])
@require_auth()
@log_requests
def get_report_statistics():
    """Get report statistics."""
    try:
        topic_id = request.args.get('topic_id')

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)

        # Get statistics
        stats = report_model.get_report_statistics(topic_id=topic_id)

        # Filter stats based on user permissions
        if topic_id:
            topic_model = Topic(current_app.db)
            permission_level = topic_model.get_user_permission_level(topic_id, user_id)
            if permission_level < 2:  # Not moderator or owner
                return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        return jsonify({
            'success': True,
            'data': stats
        }), 200

    except Exception as e:
        logger.error(f"Get report statistics error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get report statistics']}), 500


@reports_bp.route('/recent', methods=['GET'])
@require_auth()
@log_requests
def get_recent_reports():
    """Get recent reports for dashboard."""
    try:
        limit = int(request.args.get('limit', 10))
        topic_id = request.args.get('topic_id')

        if limit < 1 or limit > 50:
            limit = 10

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)

        # Get recent reports
        reports = report_model.get_recent_reports(limit=limit, topic_id=topic_id)

        # Filter based on user permissions
        filtered_reports = []
        for report in reports:
            if can_user_view_report(report, user_id, current_app.db):
                filtered_reports.append(report)

        return jsonify({
            'success': True,
            'data': filtered_reports
        }), 200

    except Exception as e:
        logger.error(f"Get recent reports error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get recent reports']}), 500


@reports_bp.route('/my', methods=['GET'])
@require_auth()
@log_requests
def get_user_reports():
    """Get reports submitted by or about the current user."""
    try:
        as_reporter = request.args.get('as_reporter', 'true').lower() == 'true'
        status = request.args.get('status')
        limit = int(request.args.get('limit', 20))

        if limit < 1 or limit > 50:
            limit = 20

        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        report_model = Report(current_app.db)

        # Get user reports
        reports = report_model.get_user_reports(user_id, as_reporter=as_reporter)

        # Filter by status if specified
        if status:
            reports = [r for r in reports if r.get('status') == status]

        # Apply limit
        reports = reports[:limit]

        return jsonify({
            'success': True,
            'data': reports,
            'as_reporter': as_reporter
        }), 200

    except Exception as e:
        logger.error(f"Get user reports error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user reports']}), 500


@reports_bp.route('/<report_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_report(report_id):
    """Delete a report (system maintenance)."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        # Only allow admins to delete reports
        # (This would need proper role-based access control)
        user = current_user_result['user']
        if not user.get('is_admin', False):
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        report_model = Report(current_app.db)
        success = report_model.delete_report(report_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Report deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to delete report']}), 400

    except Exception as e:
        logger.error(f"Delete report error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to delete report']}), 500


def can_user_view_report(report, user_id, db):
    """Check if user has permission to view a report."""
    # Users can view reports they submitted
    if str(report.get('reported_by')) == str(user_id):
        return True

    # Admins can view all reports
    from models.user import User
    user_model = User(db)
    user = user_model.get_user_by_id(user_id)
    if user and user.get('is_admin', False):
        return True

    # Check if user is moderator/owner of the topic
    if report.get('topic_id'):
        from models.topic import Topic
        topic_model = Topic(db)
        permission_level = topic_model.get_user_permission_level(str(report['topic_id']), user_id)
        return permission_level >= 2  # Moderator or owner

    return False


def can_user_review_report(report, user_id, db):
    """Check if user has permission to review a report."""
    # Admins can review all reports
    from models.user import User
    user_model = User(db)
    user = user_model.get_user_by_id(user_id)
    if user and user.get('is_admin', False):
        return True

    # Check if user is moderator/owner of the topic
    if report.get('topic_id'):
        from models.topic import Topic
        topic_model = Topic(db)
        permission_level = topic_model.get_user_permission_level(str(report['topic_id']), user_id)
        return permission_level >= 2  # Moderator or owner

    return False