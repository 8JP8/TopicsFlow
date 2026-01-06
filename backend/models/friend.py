from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
from pymongo.errors import OperationFailure


class Friend:
    """Friend model for managing user friendships and friend requests."""

    def __init__(self, db):
        self.db = db
        self.collection = db.friends
        
        # Create indexes for friends collection
        try:
            # Create unique index for friend relationships (all statuses)
            # Note: This allows multiple statuses between same users (pending -> accepted)
            self.collection.create_index(
                [('from_user_id', 1), ('to_user_id', 1)],
                unique=True,
                name='from_user_id_1_to_user_id_1'
            )
            # Create index on status for filtering
            self.collection.create_index([('status', 1)])
            # Create index for querying by from_user_id
            self.collection.create_index([('from_user_id', 1)])
            # Create index for querying by to_user_id
            self.collection.create_index([('to_user_id', 1)])
        except Exception:
            # Index might already exist, that's ok
            pass

    def send_friend_request(self, from_user_id: str, to_user_id: str) -> Dict[str, Any]:
        """Send a friend request."""
        # Validate input - check for None, empty string, or 'None'/'null' strings
        if not from_user_id or from_user_id in [None, 'None', 'null', '']:
            raise ValueError(f"from_user_id is required (received: {from_user_id})")
        
        if not to_user_id or to_user_id in [None, 'None', 'null', '']:
            raise ValueError(f"to_user_id is required (received: {to_user_id})")
        
        # Ensure IDs are strings and valid ObjectId format
        try:
            from_user_id = str(from_user_id).strip()
            to_user_id = str(to_user_id).strip()
            
            # Check again after string conversion
            if not from_user_id or from_user_id in ['None', 'null']:
                raise ValueError(f"from_user_id is invalid after conversion: {from_user_id}")
            
            if not to_user_id or to_user_id in ['None', 'null']:
                raise ValueError(f"to_user_id is invalid after conversion: {to_user_id}")
            
            # Validate ObjectId format
            from_obj_id = ObjectId(from_user_id)
            to_obj_id = ObjectId(to_user_id)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid user ID format: from_user_id={from_user_id}, to_user_id={to_user_id}, error={str(e)}")
        
        if from_user_id == to_user_id:
            raise ValueError("Cannot send friend request to yourself")

        # Check if already friends
        if self.are_friends(from_user_id, to_user_id):
            raise ValueError("Users are already friends")

        # Check if request already exists - use the ObjectIds already created above
        existing = self.collection.find_one({
            '$or': [
                {'from_user_id': from_obj_id, 'to_user_id': to_obj_id},
                {'from_user_id': to_obj_id, 'to_user_id': from_obj_id}
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

        # Create new friend request - use the ObjectIds already validated above
        # They were already created in the validation block, so reuse them
        friend_data = {
            'from_user_id': from_obj_id,
            'to_user_id': to_obj_id,
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        # Final validation - ensure ObjectIds are not None before insertion
        if friend_data.get('from_user_id') is None or friend_data.get('to_user_id') is None:
            raise ValueError(f"Friend data contains None values: from_user_id={friend_data.get('from_user_id')}, to_user_id={friend_data.get('to_user_id')}")
        
        # Additional check - verify ObjectIds are actually ObjectId instances
        if not isinstance(friend_data['from_user_id'], ObjectId) or not isinstance(friend_data['to_user_id'], ObjectId):
            raise ValueError(f"Invalid ObjectId instances: from_user_id type={type(friend_data['from_user_id'])}, to_user_id type={type(friend_data['to_user_id'])}")

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

    def reject_friend_request(self, request_id: str, user_id: str) -> Optional[Dict[str, str]]:
        """Reject a friend request."""
        request = self.collection.find_one({
            '_id': ObjectId(request_id),
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        })
        
        if not request:
            return None

        from_user_id = str(request['from_user_id'])
        result = self.collection.delete_one({'_id': ObjectId(request_id)})

        if result.deleted_count > 0:
            return {'from_user_id': from_user_id, 'to_user_id': user_id}
        return None

    def cancel_friend_request(self, request_id: str, user_id: str) -> Optional[Dict[str, str]]:
        """Cancel a sent friend request."""
        request = self.collection.find_one({
            '_id': ObjectId(request_id),
            'from_user_id': ObjectId(user_id),
            'status': 'pending'
        })
        
        if not request:
            return None

        to_user_id = str(request['to_user_id'])
        result = self.collection.delete_one({'_id': ObjectId(request_id)})

        if result.deleted_count > 0:
            return {'from_user_id': user_id, 'to_user_id': to_user_id}
        return None

    def remove_friend(self, user_id: str, friend_id: str) -> bool:
        """Remove a friend."""
        # This one already has the IDs passed in
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
        def _is_cosmos_index_sort_error(err: Exception) -> bool:
            msg = str(err).lower()
            return (
                'composite index' in msg
                or 'order by query' in msg
                or 'index path' in msg
                or 'excluded' in msg
            )

        # Received requests (others want to be friends with me)
        received_query = {
            'to_user_id': ObjectId(user_id),
            'status': 'pending'
        }
        try:
            received = list(self.collection.find(received_query).sort([('created_at', -1)]))
        except OperationFailure as e:
            if not _is_cosmos_index_sort_error(e):
                raise
            # Cosmos may exclude created_at from indexing; fall back to _id time order
            received = list(self.collection.find(received_query).sort([('_id', -1)]))

        # Sent requests (I want to be friends with others)
        sent_query = {
            'from_user_id': ObjectId(user_id),
            'status': 'pending'
        }
        try:
            sent = list(self.collection.find(sent_query).sort([('created_at', -1)]))
        except OperationFailure as e:
            if not _is_cosmos_index_sort_error(e):
                raise
            sent = list(self.collection.find(sent_query).sort([('_id', -1)]))

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

