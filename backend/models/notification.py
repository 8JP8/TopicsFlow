from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class Notification:
    """
    Model for managing notifications.
    Stores notifications for mentions, comments, messages, etc.
    """

    def __init__(self, db):
        self.db = db
        self.collection = db.notifications
    
    def create_notification(self, user_id: str, notification_type: str, title: str, 
                           message: str, data: Optional[Dict[str, Any]] = None,
                           sender_id: Optional[str] = None,
                           context_id: Optional[str] = None,
                           context_type: Optional[str] = None) -> Optional[str]:
        """
        Create a new notification.
        
        Args:
            user_id: ID of the user to notify
            notification_type: Type of notification ('mention', 'comment', 'message', 'chatroom_message', etc.)
            title: Notification title
            message: Notification message
            data: Additional data (post_id, comment_id, sender_id, etc.)
            sender_id: ID of the user who triggered the notification
            context_id: ID of the context (post_id, chat_room_id, etc.)
            context_type: Type of context ('post', 'chat_room', 'private_message', etc.)
        """
        try:
            notification_data = {
                'user_id': ObjectId(user_id),
                'type': notification_type,
                'title': title,
                'message': message,
                'data': data or {},
                'read': False,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            if sender_id:
                notification_data['sender_id'] = ObjectId(sender_id)
            
            if context_id:
                notification_data['context_id'] = ObjectId(context_id)
            
            if context_type:
                notification_data['context_type'] = context_type
            
            result = self.collection.insert_one(notification_data)
            return str(result.inserted_id)
        except Exception as e:
            print(f"Error creating notification: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_user_notifications(self, user_id: str, limit: int = 50, 
                              unread_only: bool = False) -> List[Dict[str, Any]]:
        """Get notifications for a user."""
        try:
            query = {'user_id': ObjectId(user_id)}
            if unread_only:
                query['read'] = False
            
            notifications = list(self.collection.find(query)
                               .sort([('created_at', -1)])
                               .limit(limit))
            
            for notif in notifications:
                notif['_id'] = str(notif['_id'])
                notif['id'] = str(notif['_id'])
                notif['user_id'] = str(notif['user_id'])
                if 'sender_id' in notif:
                    notif['sender_id'] = str(notif['sender_id'])
                if 'context_id' in notif:
                    notif['context_id'] = str(notif['context_id'])
                if 'created_at' in notif and isinstance(notif['created_at'], datetime):
                    notif['created_at'] = notif['created_at'].isoformat()
                # Extract context_name from data if available
                if 'data' in notif and isinstance(notif['data'], dict):
                    if 'chat_room_name' in notif['data']:
                        notif['context_name'] = notif['data']['chat_room_name']
                    elif 'post_title' in notif['data']:
                        notif['context_name'] = notif['data']['post_title']
            
            return notifications
        except Exception as e:
            print(f"Error getting notifications: {str(e)}")
            return []
    
    def mark_as_read(self, notification_id: str, user_id: str) -> bool:
        """Mark a notification as read."""
        try:
            result = self.collection.update_one(
                {
                    '_id': ObjectId(notification_id),
                    'user_id': ObjectId(user_id)
                },
                {
                    '$set': {
                        'read': True,
                        'read_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error marking notification as read: {str(e)}")
            return False
    
    def mark_all_as_read(self, user_id: str) -> bool:
        """Mark all notifications as read for a user."""
        try:
            result = self.collection.update_many(
                {
                    'user_id': ObjectId(user_id),
                    'read': False
                },
                {
                    '$set': {
                        'read': True,
                        'read_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error marking all notifications as read: {str(e)}")
            return False
    
    def get_unread_count(self, user_id: str) -> int:
        """Get count of unread notifications for a user."""
        try:
            count = self.collection.count_documents({
                'user_id': ObjectId(user_id),
                'read': False
            })
            return count
        except Exception as e:
            print(f"Error getting unread count: {str(e)}")
            return 0
    
    def delete_notification(self, notification_id: str, user_id: str) -> bool:
        """Delete a notification."""
        try:
            result = self.collection.delete_one({
                '_id': ObjectId(notification_id),
                'user_id': ObjectId(user_id)
            })
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting notification: {str(e)}")
            return False
    
    def aggregate_notifications_by_type(self, user_id: str, 
                                      notification_type: str,
                                      group_by: str = None) -> List[Dict[str, Any]]:
        """
        Aggregate notifications by type and optional group_by field.
        Used for grouping multiple notifications (e.g., "3 new comments on Post X").
        """
        try:
            query = {
                'user_id': ObjectId(user_id),
                'type': notification_type,
                'read': False
            }
            
            if group_by:
                # Group notifications by the specified field
                pipeline = [
                    {'$match': query},
                    {'$group': {
                        '_id': f'${group_by}',
                        'count': {'$sum': 1},
                        'latest': {'$max': '$created_at'},
                        'notifications': {'$push': '$$ROOT'}
                    }},
                    {'$sort': {'latest': -1}}
                ]
                
                aggregated = list(self.collection.aggregate(pipeline))
                
                for group in aggregated:
                    # Convert ObjectIds to strings
                    for notif in group.get('notifications', []):
                        notif['_id'] = str(notif['_id'])
                        notif['id'] = str(notif['_id'])
                        notif['user_id'] = str(notif['user_id'])
                        if 'created_at' in notif and isinstance(notif['created_at'], datetime):
                            notif['created_at'] = notif['created_at'].isoformat()
                    if 'latest' in group and isinstance(group['latest'], datetime):
                        group['latest'] = group['latest'].isoformat()
                
                return aggregated
            else:
                # Just return all notifications of this type
                return self.get_user_notifications(user_id, unread_only=True)
        except Exception as e:
            print(f"Error aggregating notifications: {str(e)}")
            return []

