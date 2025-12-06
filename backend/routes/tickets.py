from flask import Blueprint, request, jsonify, current_app
from services.auth_service import AuthService
from models.ticket import Ticket
from utils.decorators import require_auth, require_json, log_requests
import logging

logger = logging.getLogger(__name__)
tickets_bp = Blueprint('tickets', __name__)


@tickets_bp.route('/', methods=['POST'])
@require_json
@require_auth()
@log_requests
def create_ticket():
    """Create a new support ticket."""
    try:
        data = request.get_json()
        category = data.get('category', 'other')
        subject = data.get('subject', '').strip()
        description = data.get('description', '').strip()
        priority = data.get('priority', 'medium')

        # Validate input
        if not subject or len(subject) < 5:
            return jsonify({'success': False, 'errors': ['Subject must be at least 5 characters']}), 400

        if not description or len(description) < 20:
            return jsonify({'success': False, 'errors': ['Description must be at least 20 characters']}), 400

        # Get current user
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user = current_user_result['user']
        user_id = user['id']
        username = user.get('username', 'Unknown')

        # Create ticket
        ticket_model = Ticket(current_app.db)
        ticket_id = ticket_model.create_ticket(
            user_id=user_id,
            username=username,
            category=category,
            subject=subject,
            description=description,
            priority=priority
        )

        # Get created ticket
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        
        # Emit admin notification
        try:
            from socketio_handlers import emit_admin_notification
            socketio = current_app.extensions.get('socketio')
            if socketio:
                emit_admin_notification(socketio, 'new_ticket', {
                    'ticket_id': str(ticket_id),
                    'category': category,
                    'priority': priority,
                    'subject': subject[:100]  # First 100 chars
                })
        except Exception as e:
            logger.warning(f"Failed to emit admin notification: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Support ticket created successfully',
            'data': ticket
        }), 201

    except Exception as e:
        logger.error(f"Create ticket error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to create ticket']}), 500


@tickets_bp.route('/my-tickets', methods=['GET'])
@tickets_bp.route('/my', methods=['GET'])
@require_auth()
@log_requests
def get_my_tickets():
    """Get current user's support tickets."""
    try:
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))

        if limit < 1 or limit > 50:
            limit = 20
        if offset < 0:
            offset = 0

        # Get current user
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user_id = current_user_result['user']['id']

        # Get user's tickets
        ticket_model = Ticket(current_app.db)
        tickets = ticket_model.get_user_tickets(user_id, limit=limit, offset=offset)

        total_count = len(tickets)

        return jsonify({
            'success': True,
            'data': tickets,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total_count,
                'has_more': len(tickets) == limit
            }
        }), 200

    except Exception as e:
        logger.error(f"Get my tickets error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get tickets']}), 500


@tickets_bp.route('/<ticket_id>', methods=['GET'])
@require_auth()
@log_requests
def get_ticket_by_id(ticket_id):
    """Get a specific ticket by ID."""
    try:
        # Get current user
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user = current_user_result['user']
        user_id = user['id']

        # Get ticket
        ticket_model = Ticket(current_app.db)
        ticket = ticket_model.get_ticket_by_id(ticket_id)

        if not ticket:
            return jsonify({'success': False, 'errors': ['Ticket not found']}), 404

        # Check if user owns this ticket or is admin
        if ticket['user_id'] != user_id and not user.get('is_admin', False):
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        return jsonify({
            'success': True,
            'data': ticket
        }), 200

    except Exception as e:
        logger.error(f"Get ticket error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get ticket']}), 500


@tickets_bp.route('/<ticket_id>', methods=['PUT'])
@require_json
@require_auth()
@log_requests
def update_ticket_as_user(ticket_id):
    """Update ticket (user can only update description, admins can update status)."""
    try:
        data = request.get_json()

        # Get current user
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user = current_user_result['user']
        user_id = user['id']

        # Get ticket
        ticket_model = Ticket(current_app.db)
        ticket = ticket_model.get_ticket_by_id(ticket_id)

        if not ticket:
            return jsonify({'success': False, 'errors': ['Ticket not found']}), 404

        # Check if user owns this ticket
        if ticket['user_id'] != user_id:
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        # Users can add messages to the ticket conversation
        message = data.get('message', '').strip()

        if message:
            # Add message to conversation
            success = ticket_model.add_message(
                ticket_id=ticket_id,
                user_id=user_id,
                message_text=message,
                is_admin=False
            )

            if success:
                updated_ticket = ticket_model.get_ticket_by_id(ticket_id)
                return jsonify({
                    'success': True,
                    'message': 'Message added successfully',
                    'data': updated_ticket
                }), 200
            else:
                return jsonify({'success': False, 'errors': ['Failed to add message']}), 400
        else:
            return jsonify({'success': False, 'errors': ['Message is required']}), 400

    except Exception as e:
        logger.error(f"Update ticket error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to update ticket']}), 500


@tickets_bp.route('/<ticket_id>', methods=['DELETE'])
@require_auth()
@log_requests
def delete_ticket(ticket_id):
    """Delete a ticket (user can only delete their own tickets if pending)."""
    try:
        # Get current user
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        user = current_user_result['user']
        user_id = user['id']

        # Get ticket
        ticket_model = Ticket(current_app.db)
        ticket = ticket_model.get_ticket_by_id(ticket_id)

        if not ticket:
            return jsonify({'success': False, 'errors': ['Ticket not found']}), 404

        # Check if user owns this ticket
        if ticket['user_id'] != user_id and not user.get('is_admin', False):
            return jsonify({'success': False, 'errors': ['Permission denied']}), 403

        # Users can only delete pending tickets, admins can delete any
        if ticket['status'] != 'pending' and not user.get('is_admin', False):
            return jsonify({'success': False, 'errors': ['Cannot delete tickets that are being processed']}), 403

        success = ticket_model.delete_ticket(ticket_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Ticket deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'errors': ['Failed to delete ticket']}), 400

    except Exception as e:
        logger.error(f"Delete ticket error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to delete ticket']}), 500


@tickets_bp.route('/categories', methods=['GET'])
@require_auth()
@log_requests
def get_ticket_categories():
    """Get available ticket categories."""
    try:
        categories = [
            {'value': 'bug', 'label': 'Bug Report'},
            {'value': 'feature', 'label': 'Feature Request'},
            {'value': 'account', 'label': 'Account Issue'},
            {'value': 'other', 'label': 'Other'}
        ]

        return jsonify({
            'success': True,
            'data': categories
        }), 200

    except Exception as e:
        logger.error(f"Get ticket categories error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Failed to get categories']}), 500
