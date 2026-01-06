from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class VoipCall:
    """VoipCall model for managing voice calls in chat rooms and direct messages."""
    
    # Timeouts
    OFFLINE_TIMEOUT_MINUTES = 5
    SOLO_CALL_TIMEOUT_HOURS = 5
    STALE_CALL_TIMEOUT_HOURS = 24
    
    def __init__(self, db):
        self.db = db
        self.collection = db.voip_calls
        self.users_collection = db.users
    
    def create_call(self, room_id: str, room_type: str, created_by: str, room_name: str = None) -> Optional[Dict[str, Any]]:
        """Create a new VOIP call session.
        
        Args:
            room_id: The chat_room_id or DM conversation partner's user_id
            room_type: 'group' for group chats, 'dm' for direct messages
            created_by: User ID of the call initiator
            room_name: Optional name of the room for display purposes
        
        Returns:
            The created call document or None on failure
        """
        # Check if there's already an active call for this room
        existing_call = self.get_active_call(room_id)
        if existing_call:
            return None  # Call already exists
        
        # Get creator user info
        creator_info = self._get_user_info(created_by)
        
        call_doc = {
            'room_id': room_id,
            'room_type': room_type,
            'room_name': room_name,
            'created_at': datetime.utcnow(),
            'created_by': created_by,
            'participants': [{
                'user_id': created_by,
                'username': creator_info.get('username', 'Unknown'),
                'profile_picture': creator_info.get('profile_picture'),
                'joined_at': datetime.utcnow(),
                'last_heartbeat': datetime.utcnow(),
                'is_muted': False,
                'is_disconnected': False
            }],
            'status': 'active'
        }
        
        result = self.collection.insert_one(call_doc)
        call_doc['id'] = str(result.inserted_id)
        call_doc['_id'] = str(result.inserted_id)
        logger.info(f"New VOIP call created: {call_doc['id']} in room {room_id} by {created_by}")
        return self._process_call(call_doc)
    
    def get_active_call(self, room_id: str) -> Optional[Dict[str, Any]]:
        """Get the active call for a room if one exists."""
        call = self.collection.find_one({
            'room_id': room_id,
            'status': 'active'
        })
        if call:
            return self._process_call(call)
        return None
    
    def get_call_by_id(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get a call by its ID."""
        try:
            call = self.collection.find_one({'_id': ObjectId(call_id)})
            if call:
                return self._process_call(call)
        except Exception:
            pass
        return None
    
    def join_call(self, call_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Add a user to a call."""
        try:
            # Check if user is already in the call
            call = self.collection.find_one({'_id': ObjectId(call_id), 'status': 'active'})
            if not call:
                return None
            
            # Check if user is already a participant
            for participant in call.get('participants', []):
                if participant.get('user_id') == user_id:
                    # Update their status to connected and refresh heartbeat
                    self.collection.update_one(
                        {'_id': ObjectId(call_id), 'participants.user_id': user_id},
                        {
                            '$set': {
                                'participants.$.is_disconnected': False,
                                'participants.$.last_heartbeat': datetime.utcnow()
                            }
                        }
                    )
                    return self.get_call_by_id(call_id)
            
            # Get user info
            user_info = self._get_user_info(user_id)
            
            # Add user to participants with full info
            result = self.collection.update_one(
                {'_id': ObjectId(call_id), 'status': 'active'},
                {
                    '$push': {
                        'participants': {
                            'user_id': user_id,
                            'username': user_info.get('username', 'Unknown'),
                            'profile_picture': user_info.get('profile_picture'),
                            'joined_at': datetime.utcnow(),
                            'last_heartbeat': datetime.utcnow(),
                            'is_muted': False,
                            'is_disconnected': False
                        }
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"User {user_id} joined VOIP call {call_id}")
                return self.get_call_by_id(call_id)
        except Exception as e:
            logger.error(f"Error joining call {call_id} for user {user_id}: {e}")
        return None
    
    def leave_call(self, call_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Remove a user from a call. Ends call if no participants remain."""
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(call_id), 'status': 'active'},
                {
                    '$pull': {
                        'participants': {'user_id': user_id}
                    }
                }
            )
            
            if result.modified_count > 0:
                # Check if call is now empty
                call = self.get_call_by_id(call_id)
                if call and len(call.get('participants', [])) == 0:
                    # End the call
                    logger.info(f"Ending call {call_id} because no participants remain after user {user_id} left")
                    self.end_call(call_id, 'no_participants')
                    return {'ended': True, 'call_id': call_id}
                return call
        except Exception as e:
            logger.error(f"Error leaving call {call_id} for user {user_id}: {e}")
        return None
    
    def end_call(self, call_id: str, reason: str = None) -> bool:
        """End a call (set status to ended)."""
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(call_id)},
                {
                    '$set': {
                        'status': 'ended',
                        'ended_at': datetime.utcnow(),
                        'end_reason': reason
                    }
                }
            )
            if result.modified_count > 0:
                logger.info(f"Call {call_id} ended. Reason: {reason or 'Not specified'}")
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error ending call {call_id}: {e}")
        return False
    
    def set_mute_status(self, call_id: str, user_id: str, is_muted: bool) -> bool:
        """Set the mute status for a participant."""
        try:
            result = self.collection.update_one(
                {
                    '_id': ObjectId(call_id),
                    'status': 'active',
                    'participants.user_id': user_id
                },
                {
                    '$set': {
                        'participants.$.is_muted': is_muted
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error setting mute status: {e}")
        return False
    
    def update_heartbeat(self, call_id: str, user_id: str) -> bool:
        """Update the heartbeat timestamp for a participant."""
        try:
            result = self.collection.update_one(
                {
                    '_id': ObjectId(call_id),
                    'status': 'active',
                    'participants.user_id': user_id
                },
                {
                    '$set': {
                        'participants.$.last_heartbeat': datetime.utcnow(),
                        'participants.$.is_disconnected': False
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating heartbeat: {e}")
        return False
    
    def set_disconnected_status(self, call_id: str, user_id: str, is_disconnected: bool) -> bool:
        """Set the disconnected status for a participant."""
        try:
            result = self.collection.update_one(
                {
                    '_id': ObjectId(call_id),
                    'status': 'active',
                    'participants.user_id': user_id
                },
                {
                    '$set': {
                        'participants.$.is_disconnected': is_disconnected
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error setting disconnected status: {e}")
        return False
    
    def get_user_active_call(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get the active call a user is participating in (only one allowed)."""
        call = self.collection.find_one({
            'status': 'active',
            'participants.user_id': user_id
        })
        if call:
            return self._process_call(call)
        return None
    
    def get_user_active_calls(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all active calls a user is participating in."""
        calls = list(self.collection.find({
            'status': 'active',
            'participants.user_id': user_id
        }))
        return [self._process_call(call) for call in calls]
    
    def check_and_remove_offline_participants(self) -> List[Dict[str, Any]]:
        """Check for participants who have been offline too long and remove them.
        Returns list of affected calls with removed users."""
        cutoff = datetime.utcnow() - timedelta(minutes=self.OFFLINE_TIMEOUT_MINUTES)
        
        affected = []
        
        # Find all active calls with offline participants
        calls = list(self.collection.find({'status': 'active'}))
        
        for call in calls:
            call_id = str(call['_id'])
            removed_users = []
            
            for participant in call.get('participants', []):
                last_heartbeat = participant.get('last_heartbeat')
                if last_heartbeat and last_heartbeat < cutoff:
                    # Remove this participant
                    self.collection.update_one(
                        {'_id': call['_id']},
                        {'$pull': {'participants': {'user_id': participant['user_id']}}}
                    )
                    removed_users.append({
                        'user_id': participant['user_id'],
                        'username': participant.get('username', 'Unknown'),
                        'reason': 'offline_timeout'
                    })
            
            if removed_users:
                # Check if call is now empty
                updated_call = self.get_call_by_id(call_id)
                if updated_call and len(updated_call.get('participants', [])) == 0:
                    logger.info(f"Ending call {call_id} during offline cleanup (no participants remain)")
                    self.end_call(call_id, 'no_participants_offline')
                    affected.append({
                        'call_id': call_id,
                        'removed_users': removed_users,
                        'call_ended': True
                    })
                else:
                    affected.append({
                        'call_id': call_id,
                        'removed_users': removed_users,
                        'call_ended': False
                    })
        
        return affected
    
    def check_and_end_solo_calls(self) -> List[str]:
        """End calls where only one participant has been alone for too long.
        Returns list of ended call IDs."""
        cutoff = datetime.utcnow() - timedelta(hours=self.SOLO_CALL_TIMEOUT_HOURS)
        
        ended_calls = []
        
        # Find active calls with only one participant where call started before cutoff
        calls = list(self.collection.find({
            'status': 'active',
            'created_at': {'$lt': cutoff}
        }))
        
        for call in calls:
            if len(call.get('participants', [])) == 1:
                call_id = str(call['_id'])
                self.end_call(call_id, 'solo_timeout')
                ended_calls.append(call_id)
        
        return ended_calls
    
    def cleanup_stale_calls(self, max_age_hours: int = None) -> int:
        """Clean up calls that have been active for too long (orphaned calls)."""
        if max_age_hours is None:
            max_age_hours = self.STALE_CALL_TIMEOUT_HOURS
            
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        result = self.collection.update_many(
            {
                'status': 'active',
                'created_at': {'$lt': cutoff}
            },
            {
                '$set': {
                    'status': 'ended',
                    'ended_at': datetime.utcnow(),
                    'end_reason': 'stale_cleanup'
                }
            }
        )
        return result.modified_count
    
    def _get_user_info(self, user_id: str) -> Dict[str, Any]:
        """Get user info by ID."""
        try:
            user = self.users_collection.find_one({'_id': ObjectId(user_id)})
            if user:
                return {
                    'username': user.get('username', 'Unknown'),
                    'profile_picture': user.get('profile_picture')
                }
        except Exception:
            pass
        return {'username': 'Unknown', 'profile_picture': None}
    
    def _process_call(self, call: Dict[str, Any]) -> Dict[str, Any]:
        """Process a call document for API response."""
        if call:
            call['id'] = str(call.pop('_id', call.get('id', '')))
            # Convert datetime objects to ISO strings
            if 'created_at' in call and isinstance(call['created_at'], datetime):
                call['created_at'] = call['created_at'].isoformat()
            if 'ended_at' in call and isinstance(call['ended_at'], datetime):
                call['ended_at'] = call['ended_at'].isoformat()
            
            # Enrich participants with user data if missing
            enriched_participants = []
            for participant in call.get('participants', []):
                if 'joined_at' in participant and isinstance(participant['joined_at'], datetime):
                    participant['joined_at'] = participant['joined_at'].isoformat()
                if 'last_heartbeat' in participant and isinstance(participant['last_heartbeat'], datetime):
                    participant['last_heartbeat'] = participant['last_heartbeat'].isoformat()
                
                # If username is missing, fetch it
                if not participant.get('username') or participant.get('username') == 'Unknown':
                    user_info = self._get_user_info(participant.get('user_id', ''))
                    participant['username'] = user_info.get('username', 'Unknown')
                    participant['profile_picture'] = user_info.get('profile_picture')
                
                enriched_participants.append(participant)
            
            call['participants'] = enriched_participants
        return call
