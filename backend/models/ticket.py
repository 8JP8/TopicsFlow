from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class Ticket:
    """Ticket model for user support tickets and help requests."""

    def __init__(self, db):
        self.db = db
        self.collection = db.tickets

    def create_ticket(self, user_id: str, username: str, category: str,
                     subject: str, description: str, priority: str = 'medium') -> str:
        """Create a new support ticket.

        Args:
            user_id: User creating the ticket
            username: Username of the user
            category: Ticket category (bug, feature, account, other)
            subject: Ticket subject/title
            description: Detailed description
            priority: Priority level (low, medium, high)

        Returns:
            Ticket ID as string
        """
        valid_categories = ['bug', 'feature', 'account', 'other']
        valid_priorities = ['low', 'medium', 'high']

        if category not in valid_categories:
            category = 'other'

        if priority not in valid_priorities:
            priority = 'medium'

        # Create initial message from description
        initial_message = {
            'id': str(ObjectId()),
            'user_id': user_id,
            'username': username,
            'is_admin': False,
            'message': description.strip(),
            'created_at': datetime.utcnow()
        }

        ticket_data = {
            'user_id': ObjectId(user_id),
            'username': username,
            'category': category,
            'subject': subject.strip(),
            'description': description.strip(),
            'status': 'pending',  # pending, in_progress, resolved, closed
            'priority': priority,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'admin_response': None,  # Keep for backward compatibility
            'messages': [initial_message],  # Array of messages for conversation, starts with description
            'reviewed_by': None,  # Admin user_id
            'reviewed_at': None
        }

        result = self.collection.insert_one(ticket_data)
        return str(result.inserted_id)

    def get_ticket_by_id(self, ticket_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific ticket by ID."""
        try:
            ticket = self.collection.find_one({'_id': ObjectId(ticket_id)})
            if ticket:
                return self._format_ticket(ticket)
            return None
        except Exception:
            return None

    def get_user_tickets(self, user_id: str, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all tickets created by a specific user."""
        tickets = list(self.collection.find({'user_id': ObjectId(user_id)})
                      .sort([('created_at', -1)])
                      .skip(offset)
                      .limit(limit))

        return [self._format_ticket(ticket) for ticket in tickets]

    def get_all_tickets(self, status: Optional[str] = None, category: Optional[str] = None,
                       priority: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all tickets with optional filtering (admin only).

        Args:
            status: Filter by status (pending, open, in_progress, resolved, closed)
            category: Filter by category
            priority: Filter by priority
            limit: Maximum number of tickets to return
            offset: Number of tickets to skip

        Returns:
            List of formatted tickets
        """
        query = {}

        if status:
            # Map 'open' to 'pending' for backward compatibility
            if status == 'open':
                # Support both 'open' and 'pending' statuses
                query['status'] = {'$in': ['open', 'pending']}
            elif status == 'pending':
                # Also handle 'pending' explicitly
                query['status'] = {'$in': ['open', 'pending']}
            else:
                query['status'] = status
        if category:
            query['category'] = category
        if priority:
            query['priority'] = priority

        tickets = list(self.collection.find(query)
                      .sort([('priority', -1), ('created_at', -1)])
                      .skip(offset)
                      .limit(limit))

        return [self._format_ticket(ticket) for ticket in tickets]

    def update_ticket_status(self, ticket_id: str, status: str, admin_id: str,
                           admin_response: Optional[str] = None) -> bool:
        """Update ticket status and optionally add admin response.

        Args:
            ticket_id: Ticket ID to update
            status: New status (pending, in_progress, resolved, closed, open)
            admin_id: ID of admin updating the ticket
            admin_response: Optional response message from admin

        Returns:
            True if update successful, False otherwise
        """
        valid_statuses = ['pending', 'open', 'in_progress', 'resolved', 'closed']
        if status not in valid_statuses:
            return False

        update_data = {
            'status': status,
            'updated_at': datetime.utcnow(),
            'reviewed_by': ObjectId(admin_id),
            'reviewed_at': datetime.utcnow()
        }

        if admin_response:
            update_data['admin_response'] = admin_response.strip()

        result = self.collection.update_one(
            {'_id': ObjectId(ticket_id)},
            {'$set': update_data}
        )

        return result.modified_count > 0

    def reopen_ticket(self, ticket_id: str, admin_id: str, reason: Optional[str] = None) -> bool:
        """Reopen a closed or resolved ticket.

        Args:
            ticket_id: Ticket ID to reopen
            admin_id: ID of admin reopening the ticket
            reason: Optional reason for reopening

        Returns:
            True if reopen successful, False otherwise
        """
        ticket = self.collection.find_one({'_id': ObjectId(ticket_id)})
        if not ticket:
            return False

        # Only allow reopening closed or resolved tickets
        if ticket.get('status') not in ['closed', 'resolved']:
            return False

        # Get admin username
        from .user import User
        user_model = User(self.db)
        admin_user = user_model.get_user_by_id(admin_id)
        admin_username = admin_user.get('username', 'Admin') if admin_user else 'Admin'

        # Create reopening message
        reopening_message_text = reason if reason else 'Ticket reopened'
        reopening_message = {
            'id': str(ObjectId()),
            'user_id': admin_id,
            'username': admin_username,
            'is_admin': True,
            'message': f"[REOPENED] {reopening_message_text}",
            'created_at': datetime.utcnow()
        }

        update_data = {
            'status': 'open',
            'updated_at': datetime.utcnow(),
            'reviewed_by': ObjectId(admin_id),
            'reviewed_at': datetime.utcnow()
        }

        result = self.collection.update_one(
            {'_id': ObjectId(ticket_id)},
            {
                '$push': {'messages': reopening_message},
                '$set': update_data
            }
        )

        return result.modified_count > 0

    def add_admin_response(self, ticket_id: str, admin_id: str, response: str) -> bool:
        """Add or update admin response to a ticket (now adds message to conversation).

        Args:
            ticket_id: Ticket ID
            admin_id: ID of admin responding
            response: Response message

        Returns:
            True if update successful, False otherwise
        """
        # Get admin username
        from .user import User
        user_model = User(self.db)
        admin_user = user_model.get_user_by_id(admin_id)
        admin_username = admin_user.get('username', 'Admin') if admin_user else 'Admin'

        # Create message object
        message = {
            'id': str(ObjectId()),
            'user_id': admin_id,
            'username': admin_username,
            'is_admin': True,
            'message': response.strip(),
            'created_at': datetime.utcnow()
        }

        result = self.collection.update_one(
            {'_id': ObjectId(ticket_id)},
            {
                '$push': {'messages': message},
                '$set': {
                    'admin_response': response.strip(),  # Keep for backward compatibility
                    'reviewed_by': ObjectId(admin_id),
                    'reviewed_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )

        return result.modified_count > 0

    def add_message(self, ticket_id: str, user_id: str, message_text: str, is_admin: bool = False) -> bool:
        """Add a message to ticket conversation.

        Args:
            ticket_id: Ticket ID
            user_id: ID of user sending the message
            message_text: Message content
            is_admin: Whether the sender is an admin

        Returns:
            True if message added successfully, False otherwise
        """
        # Get user info
        from .user import User
        user_model = User(self.db)
        user = user_model.get_user_by_id(user_id)
        username = user.get('username', 'Unknown') if user else 'Unknown'

        # Create message object
        message = {
            'id': str(ObjectId()),
            'user_id': user_id,
            'username': username,
            'is_admin': is_admin,
            'message': message_text.strip(),
            'created_at': datetime.utcnow()
        }

        result = self.collection.update_one(
            {'_id': ObjectId(ticket_id)},
            {
                '$push': {'messages': message},
                '$set': {
                    'updated_at': datetime.utcnow()
                }
            }
        )

        return result.modified_count > 0

    def get_ticket_count(self, status: Optional[str] = None, category: Optional[str] = None,
                        priority: Optional[str] = None) -> int:
        """Get count of tickets, optionally filtered by status, category, and priority."""
        query = {}
        if status:
            # Map 'open' to 'pending' for backward compatibility
            if status == 'open':
                # Support both 'open' and 'pending' statuses
                query['status'] = {'$in': ['open', 'pending']}
            elif status == 'pending':
                # Also handle 'pending' explicitly
                query['status'] = {'$in': ['open', 'pending']}
            else:
                query['status'] = status
        if category:
            query['category'] = category
        if priority:
            query['priority'] = priority
        return self.collection.count_documents(query)

    def get_ticket_statistics(self) -> Dict[str, Any]:
        """Get ticket statistics for admin dashboard."""
        pipeline = [
            {
                '$group': {
                    '_id': '$status',
                    'count': {'$sum': 1}
                }
            }
        ]

        status_counts = list(self.collection.aggregate(pipeline))

        stats = {
            'total': 0,
            'pending': 0,
            'in_progress': 0,
            'resolved': 0,
            'closed': 0
        }

        for status_count in status_counts:
            status = status_count['_id']
            count = status_count['count']
            stats['total'] += count
            if status in stats:
                stats[status] = count

        # Get category breakdown
        category_pipeline = [
            {
                '$group': {
                    '_id': '$category',
                    'count': {'$sum': 1}
                }
            }
        ]

        category_counts = list(self.collection.aggregate(category_pipeline))
        stats['categories'] = {cat['_id']: cat['count'] for cat in category_counts}

        # Get priority breakdown
        priority_pipeline = [
            {
                '$group': {
                    '_id': '$priority',
                    'count': {'$sum': 1}
                }
            }
        ]

        priority_counts = list(self.collection.aggregate(priority_pipeline))
        stats['priorities'] = {pri['_id']: pri['count'] for pri in priority_counts}

        return stats

    def delete_ticket(self, ticket_id: str) -> bool:
        """Delete a ticket (admin only)."""
        result = self.collection.delete_one({'_id': ObjectId(ticket_id)})
        return result.deleted_count > 0

    def _format_ticket(self, ticket: Dict[str, Any]) -> Dict[str, Any]:
        """Format ticket for API response."""
        # Convert ObjectIds to strings
        ticket['_id'] = str(ticket.get('_id', ''))
        ticket['id'] = ticket['_id']
        ticket['user_id'] = str(ticket.get('user_id', ''))

        if ticket.get('reviewed_by'):
            ticket['reviewed_by'] = str(ticket['reviewed_by'])

        # Format messages array
        messages = ticket.get('messages', [])
        formatted_messages = []
        
        # Migrate old tickets: if no messages but has admin_response, create messages from it
        if not messages and ticket.get('admin_response'):
            # Add user's initial description as first message
            if ticket.get('description'):
                formatted_messages.append({
                    'id': str(ObjectId()),
                    'user_id': str(ticket.get('user_id', '')),
                    'username': ticket.get('username', 'Unknown'),
                    'is_admin': False,
                    'message': ticket.get('description', ''),
                    'created_at': ticket.get('created_at').isoformat() if isinstance(ticket.get('created_at'), datetime) else ticket.get('created_at', '')
                })
            
            # Add admin response as second message
            reviewed_by = ticket.get('reviewed_by')
            reviewed_at = ticket.get('reviewed_at')
            formatted_messages.append({
                'id': str(ObjectId()),
                'user_id': str(reviewed_by) if reviewed_by else '',
                'username': 'Admin',
                'is_admin': True,
                'message': ticket.get('admin_response', ''),
                'created_at': reviewed_at.isoformat() if isinstance(reviewed_at, datetime) else (reviewed_at if reviewed_at else ticket.get('updated_at', ''))
            })
        elif messages:
            # Format existing messages
            for msg in messages:
                formatted_msg = {
                    'id': str(msg.get('id', str(ObjectId()))),
                    'user_id': str(msg.get('user_id', '')),
                    'username': msg.get('username', 'Unknown'),
                    'is_admin': msg.get('is_admin', False),
                    'message': msg.get('message', ''),
                    'created_at': msg.get('created_at').isoformat() if isinstance(msg.get('created_at'), datetime) else str(msg.get('created_at', ''))
                }
                formatted_messages.append(formatted_msg)
        else:
            # No messages, create initial message from description
            if ticket.get('description'):
                formatted_messages.append({
                    'id': str(ObjectId()),
                    'user_id': str(ticket.get('user_id', '')),
                    'username': ticket.get('username', 'Unknown'),
                    'is_admin': False,
                    'message': ticket.get('description', ''),
                    'created_at': ticket.get('created_at').isoformat() if isinstance(ticket.get('created_at'), datetime) else ticket.get('created_at', '')
                })
        
        ticket['messages'] = formatted_messages

        # Convert datetime to ISO format
        if isinstance(ticket.get('created_at'), datetime):
            ticket['created_at'] = ticket['created_at'].isoformat()
        if isinstance(ticket.get('updated_at'), datetime):
            ticket['updated_at'] = ticket['updated_at'].isoformat()
        if isinstance(ticket.get('reviewed_at'), datetime):
            ticket['reviewed_at'] = ticket['reviewed_at'].isoformat()

        return ticket
