from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class Report:
    """Report model for content moderation and user reports."""

    def __init__(self, db):
        self.db = db
        self.collection = db.reports

    def create_report(self, content_id: str, reporter_id: str, reason: str, theme_id: str, content_type: str = 'message') -> str:
        """Create a new report for a message, post, or comment with context."""
        # Get context messages (previous 3-4 messages from same topic/theme) if it's a message
        context_messages = []
        if content_type == 'message':
            context_messages = self._get_context_messages(content_id, theme_id)

        report_data = {
            'reported_content_id': ObjectId(content_id),
            'content_type': content_type,  # 'message', 'post', 'comment'
            'theme_id': ObjectId(theme_id),
            'reported_by': ObjectId(reporter_id),
            'reason': reason,
            'context_messages': [ObjectId(msg_id) for msg_id in context_messages],
            'status': 'pending',  # 'pending', 'reviewed', 'resolved', 'dismissed'
            'reviewed_by': None,
            'reviewed_at': None,
            'action_taken': None,  # 'deleted', 'user_banned', 'user_warned', 'dismissed'
            'moderator_notes': '',
            'created_at': datetime.utcnow()
        }

        result = self.collection.insert_one(report_data)
        return str(result.inserted_id)

    def _get_context_messages(self, message_id: str, theme_id: str, count: int = 4) -> List[str]:
        """Get previous messages for context."""
        from .message import Message
        message_model = Message(self.db)

        # Get the reported message
        reported_message = message_model.get_message_by_id(message_id)
        if not reported_message:
            return []

        # Get previous messages from same topic/theme (support both old and new format)
        context_query = {
            'is_deleted': False,
            '$or': [
                {'topic_id': ObjectId(theme_id)},
                {'chat_room_id': {'$exists': True}}  # For chat room messages, we'd need theme_id lookup
            ],
            'created_at': {'$lt': reported_message['created_at']}
        }

        context_messages = list(self.db.messages.find(context_query)
                              .sort([('created_at', -1)])
                              .limit(count))

        return [str(msg['_id']) for msg in context_messages]

    def get_report_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific report by ID."""
        report = self.collection.find_one({'_id': ObjectId(report_id)})
        if report:
            report['_id'] = str(report['_id'])
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
        # Get reported message details
        from .message import Message
        message_model = Message(self.db)
        reported_message = message_model.get_message_by_id(report['reported_message_id'])
        if reported_message:
            report['reported_message'] = reported_message

        # Get reporter details
        from .user import User
        user_model = User(self.db)
        reporter = user_model.get_user_by_id(report['reported_by'])
        if reporter:
            report['reporter'] = {
                'id': str(reporter['_id']),
                'username': reporter['username']
            }

        # Get context messages
        context_messages = []
        for msg_id in report.get('context_messages', []):
            context_msg = message_model.get_message_by_id(str(msg_id))
            if context_msg:
                context_messages.append(context_msg)
        report['context_messages_details'] = context_messages

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
        valid_actions = ['deleted', 'user_banned', 'user_warned', 'dismissed', 'escalated']
        if action_taken not in valid_actions:
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(report_id)},
            {
                '$set': {
                    'status': 'reviewed',
                    'reviewed_by': ObjectId(reviewer_id),
                    'reviewed_at': datetime.utcnow(),
                    'action_taken': action_taken,
                    'moderator_notes': moderator_notes
                }
            }
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
            # Filter by topic
            from .message import Message
            message_model = Message(self.db)
            topic_message_ids = [ObjectId(msg['_id']) for msg in
                                self.db.messages.find({'topic_id': ObjectId(topic_id)}, {'_id': 1})]
            query['reported_message_id'] = {'$in': topic_message_ids}

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
            # Filter by topic
            from .message import Message
            message_model = Message(self.db)
            topic_message_ids = [ObjectId(msg['_id']) for msg in
                                self.db.messages.find({'topic_id': ObjectId(topic_id)}, {'_id': 1})]
            match_stage = {'reported_message_id': {'$in': topic_message_ids}}

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