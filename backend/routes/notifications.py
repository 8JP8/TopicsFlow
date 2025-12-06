from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.notification import Notification
from utils.decorators import require_auth, log_requests
import logging

logger = logging.getLogger(__name__)
notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('', methods=['GET'])
@require_auth()
@log_requests
def get_notifications():
    """Get notifications for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        # Parse query parameters
        limit = int(request.args.get('limit', 50))
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'

        notification_model = Notification(current_app.db)
        notifications = notification_model.get_user_notifications(
            user_id=user_id,
            limit=limit,
            unread_only=unread_only
        )

        return jsonify({
            'success': True,
            'data': notifications
        }), 200

    except Exception as e:
        logger.error(f"Get notifications error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get notifications: {str(e)}']}), 500


@notifications_bp.route('/unread-count', methods=['GET'])
@require_auth()
@log_requests
def get_unread_count():
    """Get count of unread notifications for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_model = Notification(current_app.db)
        count = notification_model.get_unread_count(user_id)

        return jsonify({
            'success': True,
            'data': {
                'count': count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get unread count error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get unread count: {str(e)}']}), 500


@notifications_bp.route('/<notification_id>/read', methods=['POST'])
@require_auth()
@log_requests
def mark_notification_as_read(notification_id):
    """Mark a notification as read."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_model = Notification(current_app.db)
        success = notification_model.mark_as_read(notification_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Notification marked as read'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mark notification as read']}), 400

    except Exception as e:
        logger.error(f"Mark notification as read error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mark notification as read: {str(e)}']}), 500


@notifications_bp.route('/read-all', methods=['POST'])
@require_auth()
@log_requests
def mark_all_as_read():
    """Mark all notifications as read for the current user."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_model = Notification(current_app.db)
        success = notification_model.mark_all_as_read(user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'All notifications marked as read'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to mark all notifications as read']}), 400

    except Exception as e:
        logger.error(f"Mark all as read error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to mark all as read: {str(e)}']}), 500


@notifications_bp.route('/<notification_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_notification(notification_id):
    """Delete a notification."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_model = Notification(current_app.db)
        success = notification_model.delete_notification(notification_id, user_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Notification deleted'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to delete notification']}), 400

    except Exception as e:
        logger.error(f"Delete notification error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to delete notification: {str(e)}']}), 500


@notifications_bp.route('/aggregated', methods=['GET'])
@require_auth()
@log_requests
def get_aggregated_notifications():
    """Get aggregated notifications grouped by type and entity."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        user_id = current_user_result['user']['id']

        notification_type = request.args.get('type')  # 'comment', 'message', 'chatroom_message', etc.
        group_by = request.args.get('group_by', 'post_id')  # 'post_id', 'chat_room_id', 'sender_id', etc.

        notification_model = Notification(current_app.db)
        
        if notification_type:
            aggregated = notification_model.aggregate_notifications_by_type(
                user_id=user_id,
                notification_type=notification_type,
                group_by=group_by
            )
        else:
            # Get all unread notifications
            aggregated = notification_model.get_user_notifications(user_id, unread_only=True)

        return jsonify({
            'success': True,
            'data': aggregated
        }), 200

    except Exception as e:
        logger.error(f"Get aggregated notifications error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': [f'Failed to get aggregated notifications: {str(e)}']}), 500

