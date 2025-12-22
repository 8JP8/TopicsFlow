from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class Report:
    """Report model for content moderation and user reports."""

    def __init__(self, db):
        self.db = db
        self.collection = db.reports

    def create_report(self, reporter_id: str, reason: str, description: str = '',
                     content_type: str = 'message',
                     content_id: Optional[str] = None, reported_user_id: Optional[str] = None,
                     topic_id: Optional[str] = None,
                     attach_current_message: bool = False,
                     attach_message_history: bool = False,
                     current_message_id: Optional[str] = None,
                     chat_room_id: Optional[str] = None,
                     report_type: Optional[str] = None,
                     related_message_id: Optional[str] = None,
                     owner_id: Optional[str] = None,
                     owner_username: Optional[str] = None,
                     moderators: Optional[List[Dict[str, str]]] = None) -> str:
        """Create a new report for content (message, post, comment) or a user.

        Args:
            reporter_id: ID of user creating the report
            reason: Reason for the report
            description: Detailed description of the issue
            content_type: Type of report ('message', 'post', 'comment', 'user')
            content_id: ID of content being reported (for content reports)
            reported_user_id: ID of user being reported (for user reports)
            topic_id: Optional topic context
            attach_current_message: Whether to attach the current message
            attach_message_history: Whether to attach entire message history
            current_message_id: ID of the current message to attach
            chat_room_id: ID of chat room for message history

        Returns:
            Report ID as string
        """
        # Validate that either content_id or reported_user_id is provided
        if not content_id and not reported_user_id:
            raise ValueError('Either content_id or reported_user_id must be provided')

        # Get attached messages based on options
        attached_messages = []
        if attach_current_message and current_message_id:
            attached_messages.append(ObjectId(current_message_id))
        
        if attach_message_history and reported_user_id:
            # Get all messages between reporter and reported user
            history_messages = self._get_message_history(reporter_id, reported_user_id, chat_room_id)
            attached_messages.extend([ObjectId(msg_id) for msg_id in history_messages])
        
        # Remove duplicates
        attached_messages = list(set(attached_messages))

        report_data = {
            'reported_content_id': ObjectId(content_id) if content_id else None,
            'reported_user_id': ObjectId(reported_user_id) if reported_user_id else None,
            'content_type': content_type,  # 'message', 'post', 'comment', 'user', 'chat_background'
            'report_type': report_type or ('user' if reported_user_id and not content_id else 'content'),
            'topic_id': ObjectId(topic_id) if topic_id else None,
            'reported_by': ObjectId(reporter_id),
            'reason': reason,
            'description': description,
            'attached_messages': attached_messages,
            'owner_id': ObjectId(owner_id) if owner_id else None,
            'owner_username': owner_username,
            'moderators': moderators or [],  # List of {id, username} dicts
            'status': 'pending',  # 'pending', 'reviewed', 'resolved', 'dismissed'
            'reviewed_by': None,
            'reviewed_at': None,
            'action_taken': None,  # 'deleted', 'user_banned', 'user_warned', 'dismissed'
            'moderator_notes': '',
            'created_at': datetime.utcnow()
        }

        result = self.collection.insert_one(report_data)
        return str(result.inserted_id)

    def _get_context_messages(self, message_id: str, topic_id: str, count: int = 4) -> List[str]:
        """Get previous messages for context."""
        from .message import Message
        message_model = Message(self.db)

        # Get the reported message
        reported_message = message_model.get_message_by_id(message_id)
        if not reported_message:
            return []

        # Get previous messages from same topic
        context_query = {
            'is_deleted': False,
            '$or': [
                {'topic_id': ObjectId(topic_id)},
                {'chat_room_id': {'$exists': True}}  # For chat room messages
            ],
            'created_at': {'$lt': reported_message['created_at']}
        }

        context_messages = list(self.db.messages.find(context_query)
                              .sort([('created_at', -1)])
                              .limit(count))

        return [str(msg['_id']) for msg in context_messages]

    def _get_message_history(self, reporter_id: str, reported_user_id: str, chat_room_id: Optional[str] = None, limit: int = 100) -> List[str]:
        """Get message history between two users."""
        from bson import ObjectId
        
        query: Dict[str, Any] = {
            'is_deleted': False,
            '$or': [
                {
                    'user_id': ObjectId(reporter_id),
                    'recipient_id': ObjectId(reported_user_id)
                },
                {
                    'user_id': ObjectId(reported_user_id),
                    'recipient_id': ObjectId(reporter_id)
                }
            ]
        }
        
        # If chat_room_id is provided, also include chat room messages
        if chat_room_id:
            query['$or'].append({
                'chat_room_id': ObjectId(chat_room_id),
                'user_id': {'$in': [ObjectId(reporter_id), ObjectId(reported_user_id)]}
            })
        
        messages = list(self.db.messages.find(query)
                       .sort([('created_at', -1)])
                       .limit(limit))
        
        return [str(msg['_id']) for msg in messages]

    def get_report_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific report by ID."""
        report = self.collection.find_one({'_id': ObjectId(report_id)})
        if report:
            report['_id'] = str(report['_id'])
            if 'reported_message_id' in report and report['reported_message_id']:
                report['reported_message_id'] = str(report['reported_message_id'])
            report['reported_by'] = str(report['reported_by'])
            if report['reviewed_by']:
                report['reviewed_by'] = str(report['reviewed_by'])

            # Get message and context details
            self._enrich_report_with_details(report)

        return report

    def get_pending_reports(self, topic_id: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get pending reports for moderation."""
        query = {'status': 'pending'}

        if topic_id:
            # Filter by reports from specific topic
            from .message import Message
            message_model = Message(self.db)
            topic_message_ids = [ObjectId(msg['_id']) for msg in
                                self.db.messages.find({'topic_id': ObjectId(topic_id)}, {'_id': 1})]
            query['reported_message_id'] = {'$in': topic_message_ids}

        reports = list(self.collection.find(query)
                      .sort([('created_at', -1)])
                      .limit(limit)
                      .skip(offset))

        for report in reports:
            report['_id'] = str(report['_id'])
            report['reported_message_id'] = str(report['reported_message_id'])
            report['reported_by'] = str(report['reported_by'])

            # Enrich with details
            self._enrich_report_with_details(report)

        return reports

    def _enrich_report_with_details(self, report: Dict[str, Any]) -> None:
        """Enrich report with message and user details."""
        from .message import Message
        from .user import User
        
        message_model = Message(self.db)
        user_model = User(self.db)
        
        # Get reported content details (message, post, or comment)
        if report.get('reported_content_id'):
            content_id = str(report['reported_content_id'])
            if report.get('content_type') == 'message':
                reported_message = message_model.get_message_by_id(content_id)
                if reported_message:
                    report['reported_content'] = reported_message
            elif report.get('content_type') == 'private_message':
                from .private_message import PrivateMessage
                pm_model = PrivateMessage(self.db)
                reported_message = pm_model.get_message_by_id(content_id)
                if reported_message:
                    report['reported_content'] = reported_message
            elif report.get('content_type') == 'post':
                from .post import Post
                post_model = Post(self.db)
                reported_post = post_model.get_post_by_id(content_id)
                if reported_post:
                    report['reported_content'] = reported_post
            elif report.get('content_type') == 'comment':
                from .comment import Comment
                comment_model = Comment(self.db)
                reported_comment = comment_model.get_comment_by_id(content_id)
                if reported_comment:
                    report['reported_content'] = reported_comment
        
        # Get reported user details
        if report.get('reported_user_id'):
            reported_user = user_model.get_user_by_id(str(report['reported_user_id']))
            if reported_user:
                original_username = reported_user['username']
                
                # Check if reported content is anonymous
                anonymous_name = None
                if report.get('reported_content'):
                    content = report['reported_content']
                    if content.get('is_anonymous') or content.get('anonymous_identity'):
                        anonymous_name = content.get('display_name') or content.get('sender_username') or content.get('author_username') or content.get('anonymous_identity')
                
                # Format username for admins: show anonymous name with original in parentheses
                if anonymous_name:
                    report['reported_user'] = {
                        'id': str(reported_user['_id']),
                        'username': f"{anonymous_name} ({original_username})",
                        'username_display': anonymous_name,
                        'username_original': original_username
                    }
                else:
                    report['reported_user'] = {
                        'id': str(reported_user['_id']),
                        'username': original_username,
                        'username_display': original_username,
                        'username_original': original_username
                    }

        # Get reporter details
        reporter = user_model.get_user_by_id(report['reported_by'])
        if reporter:
            report['reporter'] = {
                'id': str(reporter['_id']),
                'username': reporter['username']
            }

        # Get attached messages details (including attachments)
        attached_messages_details = []
        for msg_id in report.get('attached_messages', []):
            context_msg = message_model.get_message_by_id(str(msg_id))
            if context_msg:
                # Ensure attachments are included
                if 'attachments' not in context_msg:
                    context_msg['attachments'] = []
                attached_messages_details.append(context_msg)
        report['attached_messages_details'] = attached_messages_details
        
        # Also include attachments in the reported content if it's a message
        if report.get('reported_content') and report.get('content_type') == 'message':
            if 'attachments' not in report['reported_content']:
                report['reported_content']['attachments'] = []

        # Get reviewer details if reviewed
        if report.get('reviewed_by'):
            reviewer = user_model.get_user_by_id(report['reviewed_by'])
            if reviewer:
                report['reviewer'] = {
                    'id': str(reviewer['_id']),
                    'username': reviewer['username']
                }

    def review_report(self, report_id: str, reviewer_id: str, action_taken: str,
                     moderator_notes: str = '') -> bool:
        """Review and resolve a report."""
        valid_actions = ['deleted', 'user_banned', 'user_warned', 'dismissed', 'escalated', 'resolved']
        if action_taken not in valid_actions:
            return False

        # Determine status based on action
        if action_taken == 'dismissed':
            status = 'dismissed'
        elif action_taken == 'resolved':
            status = 'resolved'
        else:
            status = 'reviewed'

        result = self.collection.update_one(
            {'_id': ObjectId(report_id)},
            {
                '$set': {
                    'status': status,
                    'reviewed_by': ObjectId(reviewer_id),
                    'reviewed_at': datetime.utcnow(),
                    'action_taken': action_taken,
                    'moderator_notes': moderator_notes
                }
            }
        )

        return result.modified_count > 0

    def reopen_report(self, report_id: str, admin_id: str, reason: Optional[str] = None) -> bool:
        """Reopen a dismissed or resolved report.

        Args:
            report_id: Report ID to reopen
            admin_id: ID of admin reopening the report
            reason: Optional reason for reopening

        Returns:
            True if reopen successful, False otherwise
        """
        report = self.collection.find_one({'_id': ObjectId(report_id)})
        if not report:
            return False

        # Only allow reopening dismissed or resolved reports
        if report.get('status') not in ['dismissed', 'resolved', 'reviewed']:
            return False

        update_data = {
            'status': 'pending',
            'reviewed_by': None,
            'reviewed_at': None,
            'action_taken': None,
            'moderator_notes': reason if reason else ''
        }

        result = self.collection.update_one(
            {'_id': ObjectId(report_id)},
            {'$set': update_data}
        )

        return result.modified_count > 0

    def dismiss_report(self, report_id: str, reviewer_id: str, reason: str = '') -> bool:
        """Dismiss a report as false positive."""
        return self.review_report(report_id, reviewer_id, 'dismissed', reason)

    def escalate_report(self, report_id: str, reviewer_id: str, reason: str = '') -> bool:
        """Escalate a report for higher level review."""
        return self.review_report(report_id, reviewer_id, 'escalated', reason)

    def get_reports_by_status(self, status: str, topic_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get reports by status."""
        query = {'status': status}
        if topic_id:
            query['topic_id'] = ObjectId(topic_id)

        reports = list(self.collection.find(query)
                      .sort([('created_at', -1)]))

        for report in reports:
            report['_id'] = str(report['_id'])
            if 'reported_content_id' in report and report['reported_content_id']:
                report['reported_content_id'] = str(report['reported_content_id'])
            if 'reported_user_id' in report and report['reported_user_id']:
                report['reported_user_id'] = str(report['reported_user_id'])
            if 'topic_id' in report and report['topic_id']:
                report['topic_id'] = str(report['topic_id'])
            report['reported_by'] = str(report['reported_by'])
            if report.get('reviewed_by'):
                report['reviewed_by'] = str(report['reviewed_by'])
            if 'attached_messages' in report and report['attached_messages']:
                report['attached_messages'] = [str(msg_id) for msg_id in report['attached_messages']]

            self._enrich_report_with_details(report)

        return reports

    def get_user_reports(self, user_id: str, as_reporter: bool = True) -> List[Dict[str, Any]]:
        """Get reports where user was either reporter or reported."""
        if as_reporter:
            query = {'reported_by': ObjectId(user_id)}
        else:
            # User who was reported (get messages they sent that were reported)
            from .message import Message
            message_model = Message(self.db)
            user_message_ids = [ObjectId(msg['_id']) for msg in
                               self.db.messages.find({'user_id': ObjectId(user_id)}, {'_id': 1})]
            query = {'reported_message_id': {'$in': user_message_ids}}

        reports = list(self.collection.find(query)
                      .sort([('created_at', -1)]))

        for report in reports:
            report['_id'] = str(report['_id'])
            report['reported_message_id'] = str(report['reported_message_id'])
            report['reported_by'] = str(report['reported_by'])
            if report['reviewed_by']:
                report['reviewed_by'] = str(report['reviewed_by'])

            self._enrich_report_with_details(report)

        return reports

    def get_report_statistics(self, topic_id: Optional[str] = None) -> Dict[str, Any]:
        """Get report statistics for moderation dashboard."""
        match_stage = {}
        if topic_id:
            match_stage = {'topic_id': ObjectId(topic_id)}

        pipeline = [
            {'$match': match_stage},
            {'$group': {
                '_id': '$status',
                'count': {'$sum': 1}
            }}
        ]

        status_counts = list(self.collection.aggregate(pipeline))

        stats = {
            'total': 0,
            'pending': 0,
            'reviewed': 0,
            'resolved': 0,
            'dismissed': 0
        }

        for status_count in status_counts:
            status = status_count['_id']
            count = status_count['count']
            stats['total'] += count
            if status in stats:
                stats[status] = count

        # Get action taken statistics
        action_pipeline = [
            {'$match': {**match_stage, 'action_taken': {'$ne': None}}},
            {'$group': {
                '_id': '$action_taken',
                'count': {'$sum': 1}
            }}
        ]

        action_counts = list(self.collection.aggregate(action_pipeline))
        stats['actions'] = {action['_id']: action['count'] for action in action_counts}

        return stats

    def get_recent_reports(self, limit: int = 10, topic_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recent reports for dashboard."""
        query = {}
        if topic_id:
            from .message import Message
            message_model = Message(self.db)
            topic_message_ids = [ObjectId(msg['_id']) for msg in
                                self.db.messages.find({'topic_id': ObjectId(topic_id)}, {'_id': 1})]
            query['reported_message_id'] = {'$in': topic_message_ids}

        reports = list(self.collection.find(query)
                      .sort([('created_at', -1)])
                      .limit(limit))

        for report in reports:
            report['_id'] = str(report['_id'])
            report['reported_message_id'] = str(report['reported_message_id'])
            report['reported_by'] = str(report['reported_by'])
            if report['reviewed_by']:
                report['reviewed_by'] = str(report['reviewed_by'])

            self._enrich_report_with_details(report)

        return reports

    def delete_report(self, report_id: str, deleted_by: str) -> bool:
        """Delete a report (for system maintenance)."""
        result = self.collection.delete_one({'_id': ObjectId(report_id)})
        return result.deleted_count > 0