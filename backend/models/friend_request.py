from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId


class FriendRequest:
    """Friend request model for managing friend connections."""

    def __init__(self, db):
        self.db = db
        self.collection = db.friend_requests
        self.friends_collection = db.friends

        # Create indexes
        self.collection.create_index([('from_user_id', 1), ('to_user_id', 1)], unique=True)
        self.collection.create_index([('to_user_id', 1), ('status', 1)])
        self.collection.create_index([('from_user_id', 1), ('status', 1)])
        self.friends_collection.create_index([('user_id', 1), ('friend_id', 1)], unique=True)

    def send_friend_request(self, from_user_id: str, to_user_id: str) -> Dict[str, Any]:
        """Send a friend request."""
        if from_user_id == to_user_id:
            return {'success': False, 'error': 'Cannot send friend request to yourself'}

        # Check if already friends
        if self.are_friends(from_user_id, to_user_id):
            return {'success': False, 'error': 'Already friends with this user'}

        # Check if request already exists
        existing = self.collection.find_one({
            '$or': [
                {'from_user_id': ObjectId(from_user_id), 'to_user_id': ObjectId(to_user_id)},
                {'from_user_id': ObjectId(to_user_id), 'to_user_id': ObjectId(from_user_id)}
            ],
            'status': 'pending'
        })

        if existing:
            return {'success': False, 'error': 'Friend request already pending'}

        # Create new friend request
        request_data = {
            'from_user_id': ObjectId(from_user_id),
            'to_user_id': ObjectId(to_user_id),
            'status': 'pending',  # pending, accepted, rejected
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        result = self.collection.insert_one(request_data)
        return {
            'success': True,
            'request_id': str(result.inserted_id),
            'message': 'Friend request sent successfully'
        }

    def accept_friend_request(self, request_id: str, user_id: str) -> Dict[str, Any]:
        """Accept a friend request."""
        request = self.collection.find_one({
            '_id': ObjectId(request_id),
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        if not request:
            return {'success': False, 'error': 'Friend request not found or already processed'}

        from_user_id = str(request['from_user_id'])
        to_user_id = str(request['to_user_id'])

        # Update request status
        self.collection.update_one(
            {'_id': ObjectId(request_id)},
            {
                '$set': {
                    'status': 'accepted',
                    'updated_at': datetime.utcnow()
                }
            }
        )

        # Add both users as friends (bidirectional)
        self.friends_collection.insert_one({
            'user_id': ObjectId(from_user_id),
            'friend_id': ObjectId(to_user_id),
            'created_at': datetime.utcnow()
        })

        self.friends_collection.insert_one({
            'user_id': ObjectId(to_user_id),
            'friend_id': ObjectId(from_user_id),
            'created_at': datetime.utcnow()
        })

        return {
            'success': True,
            'message': 'Friend request accepted'
        }

    def reject_friend_request(self, request_id: str, user_id: str) -> Dict[str, Any]:
        """Reject a friend request."""
        request = self.collection.find_one({
            '_id': ObjectId(request_id),
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        if not request:
            return {'success': False, 'error': 'Friend request not found or already processed'}

        # Update request status
        self.collection.update_one(
            {'_id': ObjectId(request_id)},
            {
                '$set': {
                    'status': 'rejected',
                    'updated_at': datetime.utcnow()
                }
            }
        )

        return {
            'success': True,
            'message': 'Friend request rejected'
        }

    def cancel_friend_request(self, request_id: str, user_id: str) -> Dict[str, Any]:
        """Cancel a sent friend request."""
        request = self.collection.find_one({
            '_id': ObjectId(request_id),
            'from_user_id': ObjectId(user_id),
            'status': 'pending'
        })

        if not request:
            return {'success': False, 'error': 'Friend request not found or already processed'}

        # Delete the request
        self.collection.delete_one({'_id': ObjectId(request_id)})

        return {
            'success': True,
            'message': 'Friend request cancelled'
        }

    def get_pending_requests(self, user_id: str) -> List[Dict[str, Any]]:
        """Get pending friend requests received by user."""
        from .user import User
        user_model = User(self.db)

        requests = list(self.collection.find({
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        }).sort('created_at', -1))

        # Add sender details
        for req in requests:
            req['_id'] = str(req['_id'])
            req['from_user_id'] = str(req['from_user_id'])
            req['to_user_id'] = str(req['to_user_id'])

            sender = user_model.get_user_by_id(req['from_user_id'])
            if sender:
                req['from_user'] = {
                    'id': str(sender['_id']),
                    'username': sender['username'],
                    'profile_picture': sender.get('profile_picture')
                }

        return requests

    def get_sent_requests(self, user_id: str) -> List[Dict[str, Any]]:
        """Get pending friend requests sent by user."""
        from .user import User
        user_model = User(self.db)

        requests = list(self.collection.find({
            'from_user_id': ObjectId(user_id),
            'status': 'pending'
        }).sort('created_at', -1))

        # Add recipient details
        for req in requests:
            req['_id'] = str(req['_id'])
            req['from_user_id'] = str(req['from_user_id'])
            req['to_user_id'] = str(req['to_user_id'])

            recipient = user_model.get_user_by_id(req['to_user_id'])
            if recipient:
                req['to_user'] = {
                    'id': str(recipient['_id']),
                    'username': recipient['username'],
                    'profile_picture': recipient.get('profile_picture')
                }

        return requests

    def get_friends(self, user_id: str) -> List[Dict[str, Any]]:
        """Get list of user's friends."""
        from .user import User
        user_model = User(self.db)

        friendships = list(self.friends_collection.find({
            'user_id': ObjectId(user_id)
        }).sort('created_at', -1))

        friends = []
        for friendship in friendships:
            friend_id = str(friendship['friend_id'])
            friend = user_model.get_user_by_id(friend_id)

            if friend:
                friends.append({
                    'id': str(friend['_id']),
                    'username': friend['username'],
                    'profile_picture': friend.get('profile_picture'),
                    'friends_since': friendship['created_at']
                })

        return friends

    def unfriend(self, user_id: str, friend_id: str) -> Dict[str, Any]:
        """Remove a friend."""
        # Delete both sides of the friendship
        result1 = self.friends_collection.delete_one({
            'user_id': ObjectId(user_id),
            'friend_id': ObjectId(friend_id)
        })

        result2 = self.friends_collection.delete_one({
            'user_id': ObjectId(friend_id),
            'friend_id': ObjectId(user_id)
        })

        if result1.deleted_count > 0 or result2.deleted_count > 0:
            return {
                'success': True,
                'message': 'Friend removed successfully'
            }
        else:
            return {
                'success': False,
                'error': 'Friend relationship not found'
            }

    def are_friends(self, user_id1: str, user_id2: str) -> bool:
        """Check if two users are friends."""
        friendship = self.friends_collection.find_one({
            'user_id': ObjectId(user_id1),
            'friend_id': ObjectId(user_id2)
        })

        return friendship is not None

    def get_friend_count(self, user_id: str) -> int:
        """Get count of user's friends."""
        return self.friends_collection.count_documents({
            'user_id': ObjectId(user_id)
        })

    def get_pending_request_count(self, user_id: str) -> int:
        """Get count of pending friend requests received."""
        return self.collection.count_documents({
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        })
