from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
import random
import string


class AnonymousIdentity:
    """Anonymous identity model for per-topic anonymous usernames."""

    def __init__(self, db):
        self.db = db
        self.collection = db.anonymous_identities

    def generate_anonymous_name(self, adjective: Optional[str] = None, noun: Optional[str] = None) -> str:
        """Generate a random anonymous name."""
        adjectives = [
            'Brave', 'Silent', 'Quick', 'Wise', 'Kind', 'Bold', 'Calm', 'Bright',
            'Cool', 'Swift', 'Sharp', 'Smart', 'Gentle', 'Strong', 'Quiet', 'Happy',
            'Mysterious', 'Creative', 'Friendly', 'Polite', 'Curious', 'Helpful',
            'Honest', 'Patient', 'Tolerant', 'Respectful', 'Thoughtful', 'Witty'
        ]

        nouns = [
            'Panda', 'Eagle', 'Lion', 'Tiger', 'Dolphin', 'Wolf', 'Fox', 'Bear',
            'Hawk', 'Owl', 'Cat', 'Dog', 'Rabbit', 'Deer', 'Horse', 'Elephant',
            'Whale', 'Shark', 'Butterfly', 'Bee', 'Ant', 'Spider', 'Snake', 'Frog',
            'Phoenix', 'Dragon', 'Unicorn', 'Griffin', 'Wizard', 'Knight', 'Ninja'
        ]

        if not adjective:
            adjective = random.choice(adjectives)
        if not noun:
            noun = random.choice(nouns)

        # Add random number to make it unique
        number = random.randint(1, 999)

        return f"{adjective}{noun}{number}"

    def create_anonymous_identity(self, user_id: str, topic_id: str,
                                 custom_name: Optional[str] = None) -> str:
        """Create an anonymous identity for a user in a topic."""
        # Check if identity already exists
        existing = self.collection.find_one({
            'user_id': ObjectId(user_id),
            'topic_id': ObjectId(topic_id)
        })

        if existing:
            return existing['anonymous_name']

        # Generate anonymous name
        if custom_name:
            anonymous_name = self._validate_and_clean_name(custom_name)
            if not anonymous_name:
                anonymous_name = self.generate_anonymous_name()
        else:
            anonymous_name = self.generate_anonymous_name()

        # Ensure uniqueness within the topic
        anonymous_name = self._ensure_unique_name(topic_id, anonymous_name)

        identity_data = {
            'user_id': ObjectId(user_id),
            'topic_id': ObjectId(topic_id),
            'anonymous_name': anonymous_name,
            'created_at': datetime.utcnow(),
            'last_used': datetime.utcnow()
        }

        result = self.collection.insert_one(identity_data)
        return anonymous_name

    def get_anonymous_identity(self, user_id: str, topic_id: str) -> Optional[str]:
        """Get user's anonymous identity for a topic."""
        identity = self.collection.find_one({
            'user_id': ObjectId(user_id),
            'topic_id': ObjectId(topic_id)
        })

        if identity:
            # Update last used time
            self.collection.update_one(
                {'_id': identity['_id']},
                {'$set': {'last_used': datetime.utcnow()}}
            )
            return identity['anonymous_name']

        return None

    def update_anonymous_identity(self, user_id: str, topic_id: str, new_name: str) -> bool:
        """Update user's anonymous identity for a topic."""
        cleaned_name = self._validate_and_clean_name(new_name)
        if not cleaned_name:
            return False

        # Ensure uniqueness within the topic
        cleaned_name = self._ensure_unique_name(topic_id, cleaned_name, user_id)

        result = self.collection.update_one(
            {
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id)
            },
            {
                '$set': {
                    'anonymous_name': cleaned_name,
                    'last_used': datetime.utcnow()
                }
            }
        )

        return result.modified_count > 0

    def regenerate_anonymous_identity(self, user_id: str, topic_id: str) -> str:
        """Generate a new anonymous identity for a user in a topic."""
        new_name = self.generate_anonymous_name()
        new_name = self._ensure_unique_name(topic_id, new_name)

        result = self.collection.update_one(
            {
                'user_id': ObjectId(user_id),
                'topic_id': ObjectId(topic_id)
            },
            {
                '$set': {
                    'anonymous_name': new_name,
                    'last_used': datetime.utcnow()
                }
            },
            upsert=True
        )

        return new_name

    def _ensure_unique_name(self, topic_id: str, name: str, exclude_user_id: Optional[str] = None) -> str:
        """Ensure anonymous name is unique within the topic."""
        original_name = name
        counter = 1

        while True:
            query = {
                'topic_id': ObjectId(topic_id),
                'anonymous_name': name
            }

            if exclude_user_id:
                query['user_id'] = {'$ne': ObjectId(exclude_user_id)}

            existing = self.collection.find_one(query)
            if not existing:
                return name

            # Add counter to make unique
            name = f"{original_name}{counter}"
            counter += 1

            # Prevent infinite loop
            if counter > 999:
                # Generate a completely new name if we can't find a unique variant
                name = self.generate_anonymous_name()
                original_name = name
                counter = 1

    def _validate_and_clean_name(self, name: str) -> Optional[str]:
        """Validate and clean a custom anonymous name."""
        if not name or not name.strip():
            return None

        # Clean the name
        name = name.strip()

        # Remove special characters, keep only letters, numbers, and spaces
        name = ''.join(c for c in name if c.isalnum() or c.isspace())

        # Length constraints
        if len(name) < 3 or len(name) > 20:
            return None

        # Check for profanity (basic list, can be expanded)
        profanity_list = ['fuck', 'shit', 'cunt', 'bitch', 'asshole', 'admin', 'moderator']
        if name.lower() in [word for word in profanity_list]:
            return None

        # Capitalize first letter of each word
        name = ' '.join(word.capitalize() for word in name.split())

        return name if name else None

    def get_user_identities(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all anonymous identities for a user across topics."""
        identities = list(self.collection.find({'user_id': ObjectId(user_id)})
                         .sort([('last_used', -1)]))

        for identity in identities:
            identity['_id'] = str(identity['_id'])
            identity['user_id'] = str(identity['user_id'])
            identity['topic_id'] = str(identity['topic_id'])

            # Get topic details
            from .topic import Topic
            topic_model = Topic(self.db)
            topic = topic_model.get_topic_by_id(identity['topic_id'])
            if topic:
                identity['topic_title'] = topic['title']
            else:
                identity['topic_title'] = 'Deleted Topic'

        return identities

    def get_topic_anonymous_users(self, topic_id: str) -> List[Dict[str, Any]]:
        """Get all anonymous identities in a topic (for display purposes)."""
        identities = list(self.collection.find({'topic_id': ObjectId(topic_id)})
                         .sort([('created_at', 1)]))

        result = []
        for identity in identities:
            result.append({
                'user_id': str(identity['user_id']),
                'anonymous_name': identity['anonymous_name'],
                'created_at': identity['created_at'],
                'last_used': identity['last_used']
            })

        return result

    def delete_identity(self, user_id: str, topic_id: str) -> bool:
        """Delete anonymous identity for a user in a topic."""
        result = self.collection.delete_one({
            'user_id': ObjectId(user_id),
            'topic_id': ObjectId(topic_id)
        })
        return result.deleted_count > 0

    def delete_user_identities(self, user_id: str) -> int:
        """Delete all anonymous identities for a user."""
        result = self.collection.delete_many({'user_id': ObjectId(user_id)})
        return result.deleted_count

    def delete_topic_identities(self, topic_id: str) -> int:
        """Delete all anonymous identities for a topic."""
        result = self.collection.delete_many({'topic_id': ObjectId(topic_id)})
        return result.deleted_count

    def find_user_by_anonymous_name(self, topic_id: str, anonymous_name: str) -> Optional[str]:
        """Find user ID by anonymous name in a topic (for moderation)."""
        identity = self.collection.find_one({
            'topic_id': ObjectId(topic_id),
            'anonymous_name': anonymous_name
        })

        if identity:
            return str(identity['user_id'])
        return None

    def get_anonymous_stats(self, user_id: str) -> Dict[str, Any]:
        """Get anonymous identity statistics for a user."""
        total_identities = self.collection.count_documents({'user_id': ObjectId(user_id)})

        pipeline = [
            {'$match': {'user_id': ObjectId(user_id)}},
            {'$group': {
                '_id': None,
                'most_recently_used': {'$max': '$last_used'},
                'oldest_created': {'$min': '$created_at'}
            }}
        ]

        stats = list(self.collection.aggregate(pipeline))
        stats_data = stats[0] if stats else {}

        return {
            'total_identities': total_identities,
            'most_recently_used': stats_data.get('most_recently_used'),
            'oldest_created': stats_data.get('oldest_created')
        }

    def cleanup_unused_identities(self, days_threshold: int = 30) -> int:
        """Clean up anonymous identities not used for a long time."""
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)

        result = self.collection.delete_many({
            'last_used': {'$lt': cutoff_date}
        })

        return result.deleted_count