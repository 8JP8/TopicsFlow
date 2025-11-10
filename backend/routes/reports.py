from flask import Blueprint, request, jsonify
from services.auth_service import AuthService
from models.report import Report
from models.topic import Topic
from utils.validators import validate_pagination_params, validate_report_reason
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/', methods=['GET'])
@require_auth()
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
    if report.get('reported_by') == user_id:
        return True

    # Check if user is moderator/owner of the topic
    from models.topic import Topic
    from models.message import Message

    topic_model = Topic(db)
    message_model = Message(db)

    # Get message to find topic
    message = message_model.get_message_by_id(report['reported_message_id'])
    if not message:
        return False

    permission_level = topic_model.get_user_permission_level(message['topic_id'], user_id)
    return permission_level >= 2  # Moderator or owner


def can_user_review_report(report, user_id, db):
    """Check if user has permission to review a report."""
    from models.topic import Topic
    from models.message import Message

    topic_model = Topic(db)
    message_model = Message(db)

    # Get message to find topic
    message = message_model.get_message_by_id(report['reported_message_id'])
    if not message:
        return False

    permission_level = topic_model.get_user_permission_level(message['topic_id'], user_id)
    return permission_level >= 2  # Moderator or owner