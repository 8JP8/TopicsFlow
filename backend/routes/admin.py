from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.report import Report
from models.ticket import Ticket
from models.user import User
from models.message import Message
from models.post import Post
from models.comment import Comment
from models.topic import Topic
from utils.decorators import require_auth, require_json, log_requests
from utils.admin_middleware import require_admin
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
admin_bp = Blueprint('admin', __name__)


# ============================================================================
# REPORTS MANAGEMENT
# ============================================================================

@admin_bp.route('/reports', methods=['GET'])
@require_auth()
@require_admin()
@log_requests
def get_all_reports():
    """Get all reports with filtering (admin only)."""
    try:
        status = request.args.get('status')
        report_type = request.args.get('report_type')  # 'user' or 'content'
        content_type = request.args.get('content_type')  # 'user', 'message', 'post', 'comment', 'chatroom', etc.
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        if limit < 1 or limit > 100:
            limit = 50
        if offset < 0:
            offset = 0

        report_model = Report(current_app.db)

        # Build query
        query = {}
        # Only add status filter if it's provided and not 'all'
        if status:
            status_value = status.strip() if isinstance(status, str) else str(status).strip()
            if status_value and status_value.lower() != 'all' and status_value:
                query['status'] = status_value
                logger.info(f"Adding status filter: {status_value}")
            else:
                logger.info(f"Ignoring status filter (all or empty): {status_value}")
        else:
            logger.info("No status filter provided")
        
        if report_type:
            report_type_value = report_type.strip() if isinstance(report_type, str) else str(report_type).strip()
            if report_type_value and report_type_value.lower() != 'all' and report_type_value:
                query['report_type'] = report_type_value
                logger.info(f"Adding report_type filter: {report_type_value}")
            else:
                logger.info(f"Ignoring report_type filter (all or empty): {report_type_value}")
        
        if content_type:
            content_type_value = content_type.strip() if isinstance(content_type, str) else str(content_type).strip()
            if content_type_value and content_type_value.lower() != 'all' and content_type_value:
                query['content_type'] = content_type_value
                logger.info(f"Adding content_type filter: {content_type_value}")
            else:
                logger.info(f"Ignoring content_type filter (all or empty): {content_type_value}")

        logger.info(f"Report filters - status: {status}, report_type: {report_type}, content_type: {content_type}, final query: {query}")

        # Get reports with the query
        reports_cursor = report_model.collection.find(query).sort([('created_at', -1)])
        total_before_limit = report_model.collection.count_documents(query)
        reports = list(reports_cursor.skip(offset).limit(limit))
        
        logger.info(f"Found {len(reports)} reports (showing {offset} to {offset + len(reports)} of {total_before_limit} total) with query {query}")

        # Format reports
        formatted_reports = []
        for report in reports:
            formatted_report = _format_report(report, current_app.db)
            formatted_reports.append(formatted_report)

        total_count = report_model.collection.count_documents(query)

        return jsonify({
            'success': True,
            'data': formatted_reports,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total_count,
                'has_more': offset + limit < total_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get all reports error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get reports']}), 500


@admin_bp.route('/reports/<report_id>/dismiss', methods=['POST'])
@require_json
@require_auth()
@require_admin()
@log_requests
def dismiss_report(report_id):
    """Dismiss a report (admin only)."""
    try:
        data = request.get_json()
        notes = data.get('notes', '')

        auth_service = AuthService(current_app.db)
        current_user = auth_service.get_current_user()
        admin_id = current_user['user']['id']

        report_model = Report(current_app.db)
        success = report_model.dismiss_report(report_id, admin_id, notes)

        if success:
            return jsonify({
                'success': True,
                'message': 'Report dismissed successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to dismiss report']}), 400

    except Exception as e:
        logger.error(f"Dismiss report error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to dismiss report']}), 500


@admin_bp.route('/reports/<report_id>/action', methods=['POST'])
@require_json
@require_auth()
@require_admin()
@log_requests
def take_action_on_report(report_id):
    """Take action on a report (delete content, ban user, etc.)."""
    try:
        data = request.get_json()
        action = data.get('action')  # 'delete_content', 'ban_user', 'warn_user'
        notes = data.get('notes', '')
        ban_duration_days = data.get('ban_duration_days')  # For temporary bans

        if not action:
            return jsonify({'success': False, 'errors': ['Action is required']}), 400

        valid_actions = ['delete_content', 'ban_user', 'warn_user', 'dismiss', 'dismissed', 'resolve', 'resolved']
        if action not in valid_actions:
            return jsonify({'success': False, 'errors': ['Invalid action']}), 400
        
        # Normalize action names
        if action == 'dismiss':
            action = 'dismissed'
        elif action == 'resolve':
            action = 'resolved'

        auth_service = AuthService(current_app.db)
        current_user = auth_service.get_current_user()
        admin_id = current_user['user']['id']

        report_model = Report(current_app.db)
        user_model = User(current_app.db)

        # Get report details
        report = report_model.collection.find_one({'_id': ObjectId(report_id)})
        if not report:
            return jsonify({'success': False, 'errors': ['Report not found']}), 404

        # Perform action
        action_result = {'success': True}
        action_taken = None

        if action == 'delete_content':
            # Delete the reported content
            content_id = str(report.get('reported_content_id'))
            content_type = report.get('content_type')

            if content_type == 'message':
                message_model = Message(current_app.db)
                message_model.delete_message(content_id, admin_id)
            elif content_type == 'post':
                post_model = Post(current_app.db)
                post_model.delete_post(content_id, admin_id)
            elif content_type == 'comment':
                comment_model = Comment(current_app.db)
                comment_model.delete_comment(content_id, admin_id)

            action_taken = 'deleted'

        elif action == 'ban_user':
            # Ban the reported user
            reported_user_id = report.get('reported_user_id')
            if not reported_user_id:
                # If reporting content, get the author
                content_id = str(report.get('reported_content_id'))
                content_type = report.get('content_type')

                if content_type == 'message':
                    message_model = Message(current_app.db)
                    content = message_model.get_message_by_id(content_id)
                    reported_user_id = content.get('user_id') if content else None
                elif content_type == 'post':
                    post_model = Post(current_app.db)
                    content = post_model.get_post_by_id(content_id)
                    reported_user_id = content.get('user_id') if content else None
                elif content_type == 'comment':
                    comment_model = Comment(current_app.db)
                    content = comment_model.get_comment_by_id(content_id)
                    reported_user_id = content.get('user_id') if content else None

            if reported_user_id:
                ban_reason = f"Report #{report_id}: {report.get('reason', 'Violation of community guidelines')}"
                user_model.ban_user(
                    str(reported_user_id),
                    ban_reason,
                    admin_id,
                    ban_duration_days
                )

            action_taken = 'user_banned'

        elif action == 'warn_user':
            # Warn the reported user
            warning_message = data.get('warning_message', '')
            if not warning_message:
                return jsonify({'success': False, 'errors': ['Warning message is required']}), 400

            reported_user_id = report.get('reported_user_id')
            if not reported_user_id:
                # If reporting content, get the author
                content_id = str(report.get('reported_content_id'))
                content_type = report.get('content_type')

                if content_type == 'message':
                    message_model = Message(current_app.db)
                    content = message_model.get_message_by_id(content_id)
                    reported_user_id = content.get('user_id') if content else None
                elif content_type == 'post':
                    post_model = Post(current_app.db)
                    content = post_model.get_post_by_id(content_id)
                    reported_user_id = content.get('user_id') if content else None
                elif content_type == 'comment':
                    comment_model = Comment(current_app.db)
                    content = comment_model.get_comment_by_id(content_id)
                    reported_user_id = content.get('user_id') if content else None

            if reported_user_id:
                user_model.warn_user(
                    str(reported_user_id),
                    warning_message,
                    admin_id,
                    report_id
                )

                # Send warning via WebSocket if user is online
                try:
                    socketio = current_app.extensions.get('socketio')
                    if socketio:
                        user_room = f"user_{str(reported_user_id)}"
                        logger.info(f"Emitting warning to room: {user_room} for user: {reported_user_id}")
                        socketio.emit('user_warning', {
                            'message': warning_message,
                            'warned_at': datetime.utcnow().isoformat(),
                            'user_id': str(reported_user_id)
                        }, room=user_room)
                        logger.info(f"Warning emitted successfully to {user_room}")
                except Exception as e:
                    logger.error(f"Failed to emit warning via socket: {str(e)}", exc_info=True)

            action_taken = 'user_warned'

        elif action == 'resolved':
            action_taken = 'resolved'

        elif action == 'dismissed':
            action_taken = 'dismissed'
        else:
            # Fallback: if no specific action matched, use the action as-is
            action_taken = action

        # Ensure action_taken is set
        if not action_taken:
            return jsonify({'success': False, 'errors': ['Invalid action or action not processed']}), 400

        # Update report status
        report_model.review_report(
            report_id,
            admin_id,
            action_taken,
            notes
        )

        return jsonify({
            'success': True,
            'message': f'Action taken: {action_taken}',
            'action': action_taken
        }), 200

    except Exception as e:
        logger.error(f"Take action on report error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to take action on report']}), 500


@admin_bp.route('/reports/<report_id>/reopen', methods=['POST'])
@require_json
@require_auth()
@require_admin()
@log_requests
def reopen_report(report_id):
    """Reopen a dismissed or resolved report (admin only)."""
    try:
        data = request.get_json()
        reason = data.get('reason', '')

        auth_service = AuthService(current_app.db)
        current_user = auth_service.get_current_user()
        admin_id = current_user['user']['id']

        report_model = Report(current_app.db)
        success = report_model.reopen_report(report_id, admin_id, reason)

        if success:
            return jsonify({
                'success': True,
                'message': 'Report reopened successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to reopen report or report cannot be reopened']}), 400

    except Exception as e:
        logger.error(f"Reopen report error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to reopen report']}), 500


# ============================================================================
# TICKETS MANAGEMENT
# ============================================================================

@admin_bp.route('/tickets', methods=['GET'])
@require_auth()
@require_admin()
@log_requests
def get_all_tickets():
    """Get all support tickets with filtering (admin only)."""
    try:
        status = request.args.get('status')
        category = request.args.get('category')
        priority = request.args.get('priority')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        if limit < 1 or limit > 100:
            limit = 50
        if offset < 0:
            offset = 0

        # Don't pass 'all' as filter value - strip whitespace and check
        status_value = status.strip() if (status and isinstance(status, str)) else (str(status).strip() if status else None)
        status_filter = None if (not status_value or status_value.lower() == 'all') else status_value
        
        category_value = category.strip() if (category and isinstance(category, str)) else (str(category).strip() if category else None)
        category_filter = None if (not category_value or category_value.lower() == 'all') else category_value
        
        priority_value = priority.strip() if (priority and isinstance(priority, str)) else (str(priority).strip() if priority else None)
        priority_filter = None if (not priority_value or priority_value.lower() == 'all') else priority_value

        logger.info(f"Ticket filters - status: {status_filter}, category: {category_filter}, priority: {priority_filter}")

        ticket_model = Ticket(current_app.db)
        tickets = ticket_model.get_all_tickets(
            status=status_filter,
            category=category_filter,
            priority=priority_filter,
            limit=limit,
            offset=offset
        )

        # Get total count using the same filters
        total_count = ticket_model.get_ticket_count(
            status=status_filter,
            category=category_filter,
            priority=priority_filter
        )
        
        logger.info(f"Ticket count: {total_count} with filters - status: {status_filter}, category: {category_filter}, priority: {priority_filter}")

        return jsonify({
            'success': True,
            'data': tickets,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total_count,
                'has_more': offset + limit < total_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get all tickets error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get tickets']}), 500


@admin_bp.route('/tickets/<ticket_id>', methods=['PUT'])
@require_json
@require_auth()
@require_admin()
@log_requests
def update_ticket(ticket_id):
    """Update ticket status and/or add response (admin only)."""
    try:
        data = request.get_json()
        status = data.get('status')
        admin_response = data.get('admin_response')
        reopen = data.get('reopen', False)  # New: reopen flag

        if not status and not admin_response and not reopen:
            return jsonify({'success': False, 'errors': ['Status, admin_response, or reopen required']}), 400

        auth_service = AuthService(current_app.db)
        current_user = auth_service.get_current_user()
        admin_id = current_user['user']['id']

        ticket_model = Ticket(current_app.db)

        if reopen:
            # Reopen the ticket
            reason = data.get('reason', 'Ticket reopened by admin')
            success = ticket_model.reopen_ticket(ticket_id, admin_id, reason)
            message = 'Ticket reopened successfully'
        elif status:
            success = ticket_model.update_ticket_status(
                ticket_id,
                status,
                admin_id,
                admin_response
            )
            message = 'Ticket updated successfully'
        else:
            success = ticket_model.add_admin_response(
                ticket_id,
                admin_id,
                admin_response
            )
            message = 'Response added successfully'

        if success:
            updated_ticket = ticket_model.get_ticket_by_id(ticket_id)
            return jsonify({
                'success': True,
                'message': message,
                'data': updated_ticket
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to update ticket']}), 400

    except Exception as e:
        logger.error(f"Update ticket error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to update ticket']}), 500


# ============================================================================
# USER MANAGEMENT
# ============================================================================

@admin_bp.route('/users/<user_id>/ban', methods=['POST'])
@require_json
@require_auth()
@require_admin()
@log_requests
def ban_user(user_id):
    """Ban a user (admin only)."""
    try:
        data = request.get_json()
        reason = data.get('reason', 'Violation of community guidelines')
        duration_days = data.get('duration_days')  # None = permanent

        if not reason:
            return jsonify({'success': False, 'errors': ['Reason is required']}), 400

        auth_service = AuthService(current_app.db)
        current_user = auth_service.get_current_user()
        admin_id = current_user['user']['id']

        # Prevent banning yourself
        if user_id == admin_id:
            return jsonify({'success': False, 'errors': ['Cannot ban yourself']}), 400

        # Prevent banning other admins
        user_model = User(current_app.db)
        target_user = user_model.get_user_by_id(user_id)
        if target_user and target_user.get('is_admin'):
            return jsonify({'success': False, 'errors': ['Cannot ban admin users']}), 403

        success = user_model.ban_user(user_id, reason, admin_id, duration_days)

        if success:
            return jsonify({
                'success': True,
                'message': 'User banned successfully',
                'ban_info': {
                    'user_id': user_id,
                    'reason': reason,
                    'duration_days': duration_days,
                    'permanent': duration_days is None
                }
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to ban user']}), 400

    except Exception as e:
        logger.error(f"Ban user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to ban user']}), 500


@admin_bp.route('/users/<user_id>/unban', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def unban_user(user_id):
    """Unban a user (admin only)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user = auth_service.get_current_user()
        admin_id = current_user['user']['id']

        user_model = User(current_app.db)
        success = user_model.unban_user(user_id, admin_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'User unbanned successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to unban user']}), 400

    except Exception as e:
        logger.error(f"Unban user error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to unban user']}), 500


@admin_bp.route('/users/banned', methods=['GET'])
@require_auth()
@require_admin()
@log_requests
def get_banned_users():
    """Get all banned users (admin only)."""
    try:
        user_model = User(current_app.db)
        
        # Get all banned users
        banned_users_cursor = user_model.collection.find({'is_banned': True})
        banned_users = []
        
        for user in banned_users_cursor:
            try:
                # Get admin who banned the user
                banned_by_user = None
                if user.get('banned_by'):
                    try:
                        banned_by_user = user_model.get_user_by_id(str(user['banned_by']))
                    except Exception as e:
                        logger.warning(f"Failed to get banned_by user: {str(e)}")
                        banned_by_user = None
                
                # Handle datetime serialization safely
                banned_at = None
                if user.get('banned_at'):
                    if isinstance(user['banned_at'], datetime):
                        banned_at = user['banned_at'].isoformat()
                    else:
                        banned_at = str(user['banned_at'])
                
                ban_expiry = None
                if user.get('ban_expiry'):
                    if isinstance(user['ban_expiry'], datetime):
                        ban_expiry = user['ban_expiry'].isoformat()
                    else:
                        ban_expiry = str(user['ban_expiry'])
                
                banned_users.append({
                    'id': str(user['_id']),
                    'username': user.get('username', 'Unknown'),
                    'email': user.get('email', ''),
                    'profile_picture': user.get('profile_picture'),
                    'ban_reason': user.get('ban_reason', 'No reason provided'),
                    'banned_at': banned_at,
                    'ban_expiry': ban_expiry,
                    'banned_by': {
                        'id': str(user['banned_by']) if user.get('banned_by') else None,
                        'username': banned_by_user.get('username') if banned_by_user and isinstance(banned_by_user, dict) else 'Unknown'
                    } if user.get('banned_by') else None,
                    'is_permanent': user.get('ban_expiry') is None
                })
            except Exception as e:
                logger.error(f"Error processing banned user {user.get('_id')}: {str(e)}", exc_info=True)
                # Continue with next user instead of failing completely
                continue
        
        # Sort by banned_at descending (most recent first)
        banned_users.sort(key=lambda x: x['banned_at'] or '', reverse=True)
        
        return jsonify({
            'success': True,
            'data': banned_users
        }), 200

    except Exception as e:
        logger.error(f"Get banned users error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get banned users']}), 500


# ============================================================================
# USER MESSAGE HISTORY
# ============================================================================

@admin_bp.route('/users/<user_id>/messages', methods=['GET'])
@require_auth()
@require_admin()
@log_requests
def get_user_messages(user_id):
    """Get recent messages from a user (admin only)."""
    try:
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        if limit < 1 or limit > 100:
            limit = 50
        if offset < 0:
            offset = 0

        message_model = Message(current_app.db)
        
        # Get messages from this user
        query = {
            'user_id': ObjectId(user_id),
            'is_deleted': False
        }
        
        messages = list(message_model.collection.find(query)
                      .sort([('created_at', -1)])
                      .skip(offset)
                      .limit(limit))
        
        # Format messages
        formatted_messages = []
        for msg in messages:
            formatted_msg = {
                'id': str(msg['_id']),
                'content': msg.get('content', ''),
                'created_at': msg.get('created_at').isoformat() if msg.get('created_at') else None,
                'topic_id': str(msg['topic_id']) if msg.get('topic_id') else None,
                'chat_room_id': str(msg['chat_room_id']) if msg.get('chat_room_id') else None,
                'is_anonymous': msg.get('is_anonymous', False),
                'gif_url': msg.get('gif_url')
            }
            formatted_messages.append(formatted_msg)
        
        total_count = message_model.collection.count_documents(query)
        
        return jsonify({
            'success': True,
            'data': formatted_messages,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total_count,
                'has_more': offset + limit < total_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get user messages error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get user messages']}), 500


# ============================================================================
# ADMIN DASHBOARD STATISTICS
# ============================================================================

@admin_bp.route('/deleted-messages', methods=['GET'])
@require_auth()
@require_admin()
@log_requests
def get_deleted_messages():
    """Get all deleted messages for admin review."""
    try:
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        if limit < 1 or limit > 100:
            limit = 50
        if offset < 0:
            offset = 0

        message_model = Message(current_app.db)
        messages = message_model.get_deleted_messages(limit=limit, skip=offset)
        total_count = message_model.get_deleted_messages_count()
        
        return jsonify({
            'success': True,
            'data': messages,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total_count,
                'has_more': offset + limit < total_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Get deleted messages error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get deleted messages']}), 500


@admin_bp.route('/deleted-messages/<message_id>/permanent-delete', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def permanently_delete_message(message_id):
    """Permanently delete a message (admin only)."""
    try:
        message_model = Message(current_app.db)
        success = message_model.permanently_delete_message(message_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Message permanently deleted'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Message not found or already deleted']}), 404

    except Exception as e:
        logger.error(f"Permanently delete message error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to permanently delete message']}), 500


@admin_bp.route('/deleted-messages/cleanup-expired', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def cleanup_expired_messages():
    """Permanently delete expired messages (admin only)."""
    try:
        message_model = Message(current_app.db)
        deleted_count = message_model.permanently_delete_expired_messages()
        
        return jsonify({
            'success': True,
            'message': f'Permanently deleted {deleted_count} expired messages',
            'deleted_count': deleted_count
        }), 200

    except Exception as e:
        logger.error(f"Cleanup expired messages error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to cleanup expired messages']}), 500


def _serialize_for_json(obj):
    """Recursively serialize ObjectIds and datetimes for JSON."""
    from bson import ObjectId
    from datetime import datetime
    
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: _serialize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_serialize_for_json(item) for item in obj]
    else:
        return obj


@admin_bp.route('/pending-deletions', methods=['GET'])
@require_auth()
@require_admin()
@log_requests
def get_pending_deletions():
    """Get all pending deletions (topics, posts, chatrooms) awaiting admin approval."""
    try:
        from models.topic import Topic
        from models.post import Post
        from models.chat_room import ChatRoom
        
        topic_model = Topic(current_app.db)
        post_model = Post(current_app.db)
        chat_room_model = ChatRoom(current_app.db)
        
        pending_topics = topic_model.get_pending_deletions()
        pending_posts = post_model.get_pending_deletions()
        pending_chatrooms = chat_room_model.get_pending_deletions()
        
        # Serialize all data to ensure no ObjectIds or datetimes remain
        pending_topics = [_serialize_for_json(t) for t in pending_topics]
        pending_posts = [_serialize_for_json(p) for p in pending_posts]
        pending_chatrooms = [_serialize_for_json(c) for c in pending_chatrooms]
        
        return jsonify({
            'success': True,
            'data': {
                'topics': pending_topics,
                'posts': pending_posts,
                'chatrooms': pending_chatrooms
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get pending deletions error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get pending deletions']}), 500


@admin_bp.route('/topics/<topic_id>/approve-deletion', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def approve_topic_deletion(topic_id):
    """Approve topic deletion (admin only)."""
    try:
        topic_model = Topic(current_app.db)
        success = topic_model.approve_topic_deletion(topic_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Topic deletion approved'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Topic not found or not pending deletion']}), 404
            
    except Exception as e:
        logger.error(f"Approve topic deletion error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to approve topic deletion']}), 500


@admin_bp.route('/topics/<topic_id>/reject-deletion', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def reject_topic_deletion(topic_id):
    """Reject topic deletion and restore it (admin only)."""
    try:
        topic_model = Topic(current_app.db)
        success = topic_model.reject_topic_deletion(topic_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Topic deletion rejected and topic restored'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Topic not found or not pending deletion']}), 404
            
    except Exception as e:
        logger.error(f"Reject topic deletion error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to reject topic deletion']}), 500


@admin_bp.route('/posts/<post_id>/approve-deletion', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def approve_post_deletion(post_id):
    """Approve post deletion (admin only)."""
    try:
        post_model = Post(current_app.db)
        success = post_model.approve_post_deletion(post_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Post deletion approved'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Post not found or not pending deletion']}), 404
            
    except Exception as e:
        logger.error(f"Approve post deletion error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to approve post deletion']}), 500


@admin_bp.route('/posts/<post_id>/reject-deletion', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def reject_post_deletion(post_id):
    """Reject post deletion and restore it (admin only)."""
    try:
        post_model = Post(current_app.db)
        success = post_model.reject_post_deletion(post_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Post deletion rejected and post restored'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Post not found or not pending deletion']}), 404
            
    except Exception as e:
        logger.error(f"Reject post deletion error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to reject post deletion']}), 500


@admin_bp.route('/chatrooms/<room_id>/approve-deletion', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def approve_chatroom_deletion(room_id):
    """Approve chatroom deletion (admin only)."""
    try:
        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.approve_chatroom_deletion(room_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Chatroom deletion approved'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Chatroom not found or not pending deletion']}), 404
            
    except Exception as e:
        logger.error(f"Approve chatroom deletion error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to approve chatroom deletion']}), 500


@admin_bp.route('/chatrooms/<room_id>/reject-deletion', methods=['POST'])
@require_auth()
@require_admin()
@log_requests
def reject_chatroom_deletion(room_id):
    """Reject chatroom deletion and restore it (admin only)."""
    try:
        chat_room_model = ChatRoom(current_app.db)
        success = chat_room_model.reject_chatroom_deletion(room_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Chatroom deletion rejected and chatroom restored'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Chatroom not found or not pending deletion']}), 404
            
    except Exception as e:
        logger.error(f"Reject chatroom deletion error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to reject chatroom deletion']}), 500


@admin_bp.route('/stats', methods=['GET'])
@require_auth()
@require_admin()
@log_requests
def get_admin_stats():
    """Get admin dashboard statistics (admin only)."""
    try:
        report_model = Report(current_app.db)
        ticket_model = Ticket(current_app.db)
        user_model = User(current_app.db)

        # Get report statistics
        report_stats = report_model.get_report_statistics()

        # Get ticket statistics
        ticket_stats = ticket_model.get_ticket_statistics()

        # Get user statistics
        total_users = user_model.collection.count_documents({})
        banned_users = user_model.collection.count_documents({'is_banned': True})
        admin_users = user_model.collection.count_documents({'is_admin': True})

        # Get recent activity counts
        from datetime import datetime, timedelta
        last_24h = datetime.utcnow() - timedelta(hours=24)
        last_7d = datetime.utcnow() - timedelta(days=7)

        new_reports_24h = report_model.collection.count_documents({
            'created_at': {'$gte': last_24h}
        })
        new_tickets_24h = ticket_model.collection.count_documents({
            'created_at': {'$gte': last_24h}
        })
        new_users_7d = user_model.collection.count_documents({
            'created_at': {'$gte': last_7d}
        })

        stats = {
            'reports': report_stats,
            'tickets': ticket_stats,
            'users': {
                'total': total_users,
                'banned': banned_users,
                'admins': admin_users,
                'new_last_7_days': new_users_7d
            },
            'recent_activity': {
                'new_reports_24h': new_reports_24h,
                'new_tickets_24h': new_tickets_24h
            }
        }

        return jsonify({
            'success': True,
            'data': stats
        }), 200

    except Exception as e:
        logger.error(f"Get admin stats error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get admin statistics']}), 500


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _format_report(report: dict, db) -> dict:
    """Format report for API response with enriched data based on content type."""
    # Convert ObjectIds to strings
    report['_id'] = str(report['_id'])
    report['id'] = str(report['_id'])
    report['reported_by'] = str(report['reported_by'])

    if report.get('reported_content_id'):
        report['reported_content_id'] = str(report['reported_content_id'])
    if report.get('reported_user_id'):
        report['reported_user_id'] = str(report['reported_user_id'])
    if report.get('topic_id'):
        report['topic_id'] = str(report['topic_id'])
    if report.get('reviewed_by'):
        report['reviewed_by'] = str(report['reviewed_by'])

    # Convert datetimes
    if isinstance(report.get('created_at'), datetime):
        report['created_at'] = report['created_at'].isoformat()
    if isinstance(report.get('reviewed_at'), datetime):
        report['reviewed_at'] = report['reviewed_at'].isoformat()

    # Enrich with user details
    user_model = User(db)

    # Get reporter
    reporter_id = report.get('reported_by')
    if isinstance(reporter_id, ObjectId):
        reporter_id = str(reporter_id)
    elif reporter_id:
        reporter_id = str(reporter_id)
    else:
        reporter_id = None
    
    if reporter_id:
        reporter = user_model.get_user_by_id(reporter_id)
        if reporter:
            report['reporter'] = {
                'id': reporter.get('id'),
                'username': reporter.get('username')
            }
            report['reporter_username'] = reporter.get('username', 'Unknown')
        else:
            report['reporter_username'] = 'Unknown'
            report['reporter'] = None
    else:
        report['reporter_username'] = 'Unknown'
        report['reporter'] = None

    # Get reported user details if user report
    if report.get('reported_user_id'):
        reported_user_id_str = str(report['reported_user_id']) if isinstance(report['reported_user_id'], ObjectId) else report['reported_user_id']
        reported_user = user_model.get_user_by_id(reported_user_id_str)
        if reported_user:
            report['reported_user'] = {
                'id': reported_user.get('id'),
                'username': reported_user.get('username'),
                'is_banned': reported_user.get('is_banned', False)
            }
            report['reported_username'] = reported_user.get('username', 'Unknown')
        else:
            report['reported_username'] = 'Unknown'
    
    # Get content-specific information based on content_type
    content_type = report.get('content_type', 'user')
    report['content_type'] = content_type
    
    # Initialize content_data structure
    report['content_data'] = {}
    
    if report.get('reported_content_id'):
        content_id = report.get('reported_content_id')
        if isinstance(content_id, ObjectId):
            content_id = str(content_id)
        else:
            content_id = str(content_id)
        
        if content_type == 'message':
            message_model = Message(db)
            content = message_model.get_message_by_id(content_id)
            if content:
                # Get user from message
                user_id = content.get('user_id')
                if isinstance(user_id, ObjectId):
                    user_id = str(user_id)
                else:
                    user_id = str(user_id)
                reported_user = user_model.get_user_by_id(user_id)
                if reported_user:
                    report['reported_user_id'] = user_id
                    original_username = reported_user.get('username', 'Unknown')
                    
                    # Check if message is anonymous and get anonymous name
                    anonymous_name = None
                    if content.get('is_anonymous') or content.get('anonymous_identity'):
                        anonymous_name = content.get('display_name') or content.get('sender_username') or content.get('anonymous_identity')
                    
                    # Format username: show anonymous name with original in parentheses for admins
                    if anonymous_name:
                        report['reported_username'] = f"{anonymous_name} ({original_username})"
                        report['reported_username_display'] = anonymous_name
                        report['reported_username_original'] = original_username
                    else:
                        report['reported_username'] = original_username
                        report['reported_username_display'] = original_username
                        report['reported_username_original'] = original_username
                    
                    report['reported_user'] = {
                        'id': reported_user.get('id'),
                        'username': original_username,
                        'is_banned': reported_user.get('is_banned', False)
                    }
                
                # Message-specific data
                report['content_data'] = {
                    'content': content.get('content', ''),
                    'message_type': content.get('message_type', 'text'),
                    'created_at': content.get('created_at').isoformat() if isinstance(content.get('created_at'), datetime) else content.get('created_at'),
                    'attachments': content.get('attachments', []),
                    'chat_room_id': str(content.get('chat_room_id')) if content.get('chat_room_id') else None,
                    'topic_id': str(content.get('topic_id')) if content.get('topic_id') else None,
                }
        elif content_type == 'post':
            post_model = Post(db)
            content = post_model.get_post_by_id(content_id)
            if content:
                # Get user from post
                user_id = content.get('user_id')
                if isinstance(user_id, ObjectId):
                    user_id = str(user_id)
                else:
                    user_id = str(user_id)
                reported_user = user_model.get_user_by_id(user_id)
                if reported_user:
                    report['reported_user_id'] = user_id
                    original_username = reported_user.get('username', 'Unknown')
                    
                    # Check if post is anonymous and get anonymous name
                    anonymous_name = None
                    if content.get('is_anonymous') or content.get('anonymous_identity'):
                        anonymous_name = content.get('display_name') or content.get('author_username') or content.get('anonymous_identity')
                    
                    # Format username: show anonymous name with original in parentheses for admins
                    if anonymous_name:
                        report['reported_username'] = f"{anonymous_name} ({original_username})"
                        report['reported_username_display'] = anonymous_name
                        report['reported_username_original'] = original_username
                    else:
                        report['reported_username'] = original_username
                        report['reported_username_display'] = original_username
                        report['reported_username_original'] = original_username
                    
                    report['reported_user'] = {
                        'id': reported_user.get('id'),
                        'username': original_username,
                        'is_banned': reported_user.get('is_banned', False)
                    }
                
                # Post-specific data
                report['content_data'] = {
                    'title': content.get('title', ''),
                    'content': content.get('content', ''),
                    'created_at': content.get('created_at').isoformat() if isinstance(content.get('created_at'), datetime) else content.get('created_at'),
                    'upvote_count': content.get('upvote_count', 0),
                    'comment_count': content.get('comment_count', 0),
                    'topic_id': str(content.get('topic_id')) if content.get('topic_id') else None,
                }
        elif content_type == 'comment':
            comment_model = Comment(db)
            content = comment_model.get_comment_by_id(content_id)
            if content:
                # Get user from comment
                user_id = content.get('user_id')
                if isinstance(user_id, ObjectId):
                    user_id = str(user_id)
                else:
                    user_id = str(user_id)
                reported_user = user_model.get_user_by_id(user_id)
                if reported_user:
                    report['reported_user_id'] = user_id
                    original_username = reported_user.get('username', 'Unknown')
                    
                    # Check if comment is anonymous and get anonymous name
                    anonymous_name = None
                    if content.get('is_anonymous') or content.get('anonymous_identity'):
                        anonymous_name = content.get('display_name') or content.get('author_username') or content.get('anonymous_identity')
                    
                    # Format username: show anonymous name with original in parentheses for admins
                    if anonymous_name:
                        report['reported_username'] = f"{anonymous_name} ({original_username})"
                        report['reported_username_display'] = anonymous_name
                        report['reported_username_original'] = original_username
                    else:
                        report['reported_username'] = original_username
                        report['reported_username_display'] = original_username
                        report['reported_username_original'] = original_username
                    
                    report['reported_user'] = {
                        'id': reported_user.get('id'),
                        'username': original_username,
                        'is_banned': reported_user.get('is_banned', False)
                    }
                
                # Comment-specific data
                report['content_data'] = {
                    'content': content.get('content', ''),
                    'created_at': content.get('created_at').isoformat() if isinstance(content.get('created_at'), datetime) else content.get('created_at'),
                    'upvote_count': content.get('upvote_count', 0),
                    'post_id': str(content.get('post_id')) if content.get('post_id') else None,
                    'parent_comment_id': str(content.get('parent_comment_id')) if content.get('parent_comment_id') else None,
                }
        elif content_type in ['chatroom', 'chatroom_background', 'chatroom_picture']:
            from models.chat_room import ChatRoom
            chat_room_model = ChatRoom(db)
            content = chat_room_model.get_chat_room_by_id(content_id)
            if content:
                # Chatroom-specific data (not user-bound)
                report['content_data'] = {
                    'name': content.get('name', ''),
                    'description': content.get('description', ''),
                    'created_at': content.get('created_at').isoformat() if isinstance(content.get('created_at'), datetime) else content.get('created_at'),
                    'topic_id': str(content.get('topic_id')) if content.get('topic_id') else None,
                    'owner': content.get('owner', {}),
                    'moderators': content.get('moderators', []),
                }
                # Include owner and moderators from report if available
                if report.get('owner_id'):
                    report['content_data']['owner_id'] = str(report['owner_id'])
                if report.get('owner_username'):
                    report['content_data']['owner_username'] = report['owner_username']
                if report.get('moderators'):
                    report['content_data']['moderators'] = report['moderators']
    
    # Include attached messages if available
    if report.get('attached_messages'):
        attached_messages = []
        message_model = Message(db)
        for msg_id in report.get('attached_messages', []):
            if isinstance(msg_id, ObjectId):
                msg_id = str(msg_id)
            else:
                msg_id = str(msg_id)
            msg = message_model.get_message_by_id(msg_id)
            if msg:
                # Include GIF URL if present
                attachments = msg.get('attachments', [])
                if msg.get('gif_url'):
                    # Add GIF as an attachment if not already in attachments
                    gif_in_attachments = any(att.get('type') == 'gif' or att.get('gif_url') for att in attachments)
                    if not gif_in_attachments:
                        attachments.append({
                            'type': 'gif',
                            'url': msg.get('gif_url'),
                            'gif_url': msg.get('gif_url'),
                            'filename': 'GIF'
                        })
                
                attached_messages.append({
                    'id': str(msg.get('_id')),
                    'content': msg.get('content', ''),
                    'created_at': msg.get('created_at').isoformat() if isinstance(msg.get('created_at'), datetime) else msg.get('created_at'),
                    'attachments': attachments,
                    'gif_url': msg.get('gif_url')  # Also include at message level for compatibility
                })
        report['attached_messages_data'] = attached_messages

    return report
