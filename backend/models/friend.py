from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class Friend:
    """Friend model for managing user friendships and friend requests."""

    def __init__(self, db):
        self.db = db
        self.collection = db.friends

    def send_friend_request(self, from_user_id: str, to_user_id: str) -> Dict[str, Any]:
        """Send a friend request."""
        if str(from_user_id) == str(to_user_id):
            raise ValueError("Cannot send friend request to yourself")

        # Check if already friends
        if self.are_friends(from_user_id, to_user_id):
            raise ValueError("Users are already friends")

        # Check if request already exists
        existing = self.collection.find_one({
            '$or': [
                {'from_user_id': ObjectId(from_user_id), 'to_user_id': ObjectId(to_user_id)},
                {'from_user_id': ObjectId(to_user_id), 'to_user_id': ObjectId(from_user_id)}
            ]
        })

        if existing:
            if existing.get('status') == 'pending':
                if str(existing['from_user_id']) == str(from_user_id):
                    raise ValueError("Friend request already sent")
                else:
                    # Auto-accept if the other user sent a request
                    return self.accept_friend_request(str(existing['_id']), to_user_id)
            elif existing.get('status') == 'accepted':
                raise ValueError("Users are already friends")

        # Create new friend request
        friend_data = {
            'from_user_id': ObjectId(from_user_id),
            'to_user_id': ObjectId(to_user_id),
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        result = self.collection.insert_one(friend_data)
        return {
            'id': str(result.inserted_id),
            'from_user_id': from_user_id,
            'to_user_id': to_user_id,
            'status': 'pending',
            'created_at': friend_data['created_at'].isoformat()
        }

    def accept_friend_request(self, request_id: str, user_id: str) -> Dict[str, Any]:
        """Accept a friend request."""
        request = self.collection.find_one({
            '_id': ObjectId(request_id),
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        if not request:
            raise ValueError("Friend request not found or already processed")

        self.collection.update_one(
            {'_id': ObjectId(request_id)},
            {
                '$set': {
                    'status': 'accepted',
                    'updated_at': datetime.utcnow()
                }
            }
        )

        return {
            'id': str(request['_id']),
            'from_user_id': str(request['from_user_id']),
            'to_user_id': str(request['to_user_id']),
            'status': 'accepted',
            'updated_at': datetime.utcnow().isoformat()
        }

    def reject_friend_request(self, request_id: str, user_id: str) -> bool:
        """Reject a friend request."""
        result = self.collection.delete_one({
            '_id': ObjectId(request_id),
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        return result.deleted_count > 0

    def cancel_friend_request(self, request_id: str, user_id: str) -> bool:
        """Cancel a sent friend request."""
        result = self.collection.delete_one({
            '_id': ObjectId(request_id),
            'from_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        return result.deleted_count > 0

    def remove_friend(self, user_id: str, friend_id: str) -> bool:
        """Remove a friend."""
        result = self.collection.delete_one({
            '$or': [
                {'from_user_id': ObjectId(user_id), 'to_user_id': ObjectId(friend_id), 'status': 'accepted'},
                {'from_user_id': ObjectId(friend_id), 'to_user_id': ObjectId(user_id), 'status': 'accepted'}
            ]
        })

        return result.deleted_count > 0

    def are_friends(self, user_id: str, other_user_id: str) -> bool:
        """Check if two users are friends."""
        friendship = self.collection.find_one({
            '$or': [
                {'from_user_id': ObjectId(user_id), 'to_user_id': ObjectId(other_user_id), 'status': 'accepted'},
                {'from_user_id': ObjectId(other_user_id), 'to_user_id': ObjectId(user_id), 'status': 'accepted'}
            ]
        })

        return friendship is not None

    def get_friends(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all friends of a user."""
        friendships = list(self.collection.find({
            '$or': [
                {'from_user_id': ObjectId(user_id), 'status': 'accepted'},
                {'to_user_id': ObjectId(user_id), 'status': 'accepted'}
            ]
        }).sort([('updated_at', -1)]))

        friends = []
        from .user import User
        user_model = User(self.db)

        for friendship in friendships:
            # Determine the friend's ID
            if str(friendship['from_user_id']) == str(user_id):
                friend_id = str(friendship['to_user_id'])
            else:
                friend_id = str(friendship['from_user_id'])

            friend_user = user_model.get_user_by_id(friend_id)
            if friend_user:
                friends.append({
                    'id': friend_id,
                    'username': friend_user['username'],
                    'email': friend_user.get('email', ''),
                    'profile_picture': friend_user.get('profile_picture'),
                    'friendship_id': str(friendship['_id']),
                    'created_at': friendship['created_at'].isoformat() if isinstance(friendship['created_at'], datetime) else friendship['created_at']
                })

        return friends

    def get_pending_requests(self, user_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """Get pending friend requests (sent and received)."""
        # Received requests (others want to be friends with me)
        received = list(self.collection.find({
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        }).sort([('created_at', -1)]))

        # Sent requests (I want to be friends with others)
        sent = list(self.collection.find({
            'from_user_id': ObjectId(user_id),
            'status': 'pending'
        }).sort([('created_at', -1)]))

        from .user import User
        user_model = User(self.db)

        received_list = []
        for req in received:
            sender = user_model.get_user_by_id(str(req['from_user_id']))
            if sender:
                received_list.append({
                    'id': str(req['_id']),
                    'from_user_id': str(req['from_user_id']),
                    'username': sender['username'],
                    'email': sender.get('email', ''),
                    'profile_picture': sender.get('profile_picture'),
                    'created_at': req['created_at'].isoformat() if isinstance(req['created_at'], datetime) else req['created_at']
                })

        sent_list = []
        for req in sent:
            receiver = user_model.get_user_by_id(str(req['to_user_id']))
            if receiver:
                sent_list.append({
                    'id': str(req['_id']),
                    'to_user_id': str(req['to_user_id']),
                    'username': receiver['username'],
                    'email': receiver.get('email', ''),
                    'profile_picture': receiver.get('profile_picture'),
                    'created_at': req['created_at'].isoformat() if isinstance(req['created_at'], datetime) else req['created_at']
                })

        return {
            'received': received_list,
            'sent': sent_list
        }

    def get_friendship_status(self, user_id: str, other_user_id: str) -> Optional[str]:
        """Get friendship status between two users."""
        friendship = self.collection.find_one({
            '$or': [
                {'from_user_id': ObjectId(user_id), 'to_user_id': ObjectId(other_user_id)},
                {'from_user_id': ObjectId(other_user_id), 'to_user_id': ObjectId(user_id)}
            ]
        })

        if not friendship:
            return None

        return friendship.get('status')

