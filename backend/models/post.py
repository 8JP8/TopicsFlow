from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
import re


class Post:
    """Post model for managing posts within topics (Reddit-style)."""

    def __init__(self, db):
        self.db = db
        self.collection = db.posts

    def create_post(self, topic_id: str, user_id: str, title: str, content: str,
                   anonymous_identity: Optional[str] = None,
                   gif_url: Optional[str] = None) -> str:
        """Create a new post in a topic."""
        # Validate and filter content
        filtered_content = self._filter_content(content)

        post_data = {
            'topic_id': ObjectId(topic_id),  # Posts belong directly to Topics
            'user_id': ObjectId(user_id),
            'title': title,
            'content': filtered_content,
            'anonymous_identity': anonymous_identity,
            'gif_url': gif_url,
            'upvotes': [],  # Array of user_ids who upvoted
            'downvotes': [],  # Array of user_ids who downvoted
            'upvote_count': 0,
            'downvote_count': 0,
            'score': 0,  # upvote_count - downvote_count
            'comment_count': 0,
            'is_deleted': False,
            'deleted_by': None,
            'deleted_at': None,
            'reports': [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        result = self.collection.insert_one(post_data)
        post_id = str(result.inserted_id)
        
        # Process mentions in title and content
        from utils.mention_parser import process_mentions_in_content
        full_content = f"{title} {filtered_content}"
        mentioned_user_ids = process_mentions_in_content(
            db=self.db,
            content=full_content,
            content_id=post_id,
            content_type='post',
            sender_id=user_id,
            context={'topic_id': topic_id, 'post_id': post_id}
        )
        
        # Update post with mentions if any
        if mentioned_user_ids:
            self.collection.update_one(
                {'_id': ObjectId(post_id)},
                {'$set': {'mentions': mentioned_user_ids}}
            )
        
        # Update topic post count and last activity
        from .topic import Topic
        topic_model = Topic(self.db)
        topic_model.increment_post_count(topic_id)

        return post_id

    def get_post_by_id(self, post_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific post by ID."""
        post = self.collection.find_one({'_id': ObjectId(post_id)})
        if post:
            post['_id'] = str(post['_id'])
            post['id'] = str(post['_id'])
            # Handle migration: support both topic_id (new) and theme_id (old)
            if 'topic_id' in post:
                post['topic_id'] = str(post['topic_id'])
            elif 'theme_id' in post:
                post['topic_id'] = str(post['theme_id'])
                del post['theme_id']
            post['user_id'] = str(post['user_id'])
            
            # Convert upvotes and downvotes list ObjectIds to strings
            if 'upvotes' in post and post['upvotes']:
                post['upvotes'] = [str(user_id) for user_id in post['upvotes']]
            if 'downvotes' in post and post['downvotes']:
                post['downvotes'] = [str(user_id) for user_id in post['downvotes']]
            
            # Calculate score if not present
            if 'score' not in post:
                up_count = post.get('upvote_count', 0)
                down_count = post.get('downvote_count', 0)
                post['score'] = up_count - down_count
            
            # Convert datetime to ISO string
            if 'created_at' in post and isinstance(post['created_at'], datetime):
                post['created_at'] = post['created_at'].isoformat()
            if 'updated_at' in post and isinstance(post['updated_at'], datetime):
                post['updated_at'] = post['updated_at'].isoformat()
            
            # Get user details (or anonymous identity)
            if post.get('anonymous_identity'):
                post['display_name'] = post['anonymous_identity']
                post['is_anonymous'] = True
                post['author_username'] = post['anonymous_identity']
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(post['user_id'])
                if user:
                    post['display_name'] = user['username']
                    post['author_username'] = user['username']
                else:
                    post['display_name'] = 'Deleted User'
                    post['author_username'] = 'Deleted User'
                post['is_anonymous'] = False

        return post

    def get_posts_by_topic(self, topic_id: str, sort_by: str = 'new',
                          limit: int = 50, offset: int = 0,
                          user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get posts for a topic with sorting and pagination."""
        # Support both topic_id (new) and theme_id (old) for migration
        query = {
            '$or': [
                {'topic_id': ObjectId(topic_id)},
                {'theme_id': ObjectId(topic_id)}  # Legacy support
            ],
            'is_deleted': False
        }

        # Determine sort order
        if sort_by == 'hot':
            # Hot posts: combination of score and recency
            sort_key = [('score', -1), ('created_at', -1)]
        elif sort_by == 'top':
            sort_key = [('score', -1)]
        elif sort_by == 'old':
            sort_key = [('created_at', 1)]
        else:  # default: 'new'
            sort_key = [('created_at', -1)]

        posts = list(self.collection.find(query)
                    .sort(sort_key)
                    .limit(limit)
                    .skip(offset))

        # Process posts
        for post in posts:
            post['_id'] = str(post['_id'])
            post['id'] = str(post['_id'])
            # Handle migration: support both topic_id (new) and theme_id (old)
            if 'topic_id' in post:
                post['topic_id'] = str(post['topic_id'])
            elif 'theme_id' in post:
                post['topic_id'] = str(post['theme_id'])
                del post['theme_id']
            post['user_id'] = str(post['user_id'])
            
            # Convert upvotes and downvotes list ObjectIds to strings
            if 'upvotes' in post and post['upvotes']:
                post['upvotes'] = [str(user_id) for user_id in post['upvotes']]
            if 'downvotes' in post and post['downvotes']:
                post['downvotes'] = [str(user_id) for user_id in post['downvotes']]
            
            # Calculate score if not present
            if 'score' not in post:
                up_count = post.get('upvote_count', 0)
                down_count = post.get('downvote_count', 0)
                post['score'] = up_count - down_count
            
            # Check if user has upvoted or downvoted
            if user_id:
                user_obj_id = ObjectId(user_id)
                post['user_has_upvoted'] = user_obj_id in post.get('upvotes', [])
                post['user_has_downvoted'] = user_obj_id in post.get('downvotes', [])
            else:
                post['user_has_upvoted'] = False
                post['user_has_downvoted'] = False
            
            # Convert datetime to ISO string
            if 'created_at' in post and isinstance(post['created_at'], datetime):
                post['created_at'] = post['created_at'].isoformat()
            if 'updated_at' in post and isinstance(post['updated_at'], datetime):
                post['updated_at'] = post['updated_at'].isoformat()
            
            # Get user details (or anonymous identity)
            if post.get('anonymous_identity'):
                post['display_name'] = post['anonymous_identity']
                post['is_anonymous'] = True
                post['author_username'] = post['anonymous_identity']
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(post['user_id'])
                if user:
                    post['display_name'] = user['username']
                    post['author_username'] = user['username']
                else:
                    post['display_name'] = 'Deleted User'
                    post['author_username'] = 'Deleted User'
                post['is_anonymous'] = False

        return posts

    def upvote_post(self, post_id: str, user_id: str) -> bool:
        """Upvote a post (toggle - if already upvoted, remove upvote). If downvoted, remove downvote and add upvote."""
        post = self.collection.find_one({'_id': ObjectId(post_id)})
        if not post:
            return False

        user_object_id = ObjectId(user_id)
        upvotes = post.get('upvotes', [])
        downvotes = post.get('downvotes', [])
        
        if user_object_id in upvotes:
            # Remove upvote
            result = self.collection.update_one(
                {'_id': ObjectId(post_id)},
                {
                    '$pull': {'upvotes': user_object_id},
                    '$inc': {'upvote_count': -1, 'score': -1},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return result.modified_count > 0
        else:
            # Remove from downvotes if present, then add upvote
            update_op = {
                '$addToSet': {'upvotes': user_object_id},
                '$inc': {'upvote_count': 1, 'score': 1},
                '$set': {'updated_at': datetime.utcnow()}
            }
            
            if user_object_id in downvotes:
                update_op['$pull'] = {'downvotes': user_object_id}
                update_op['$inc']['downvote_count'] = -1
                update_op['$inc']['score'] = 2  # +1 for upvote, +1 for removing downvote
            
            result = self.collection.update_one(
                {'_id': ObjectId(post_id)},
                update_op
            )
            return result.modified_count > 0

    def downvote_post(self, post_id: str, user_id: str) -> bool:
        """Downvote a post (toggle - if already downvoted, remove downvote). If upvoted, remove upvote and add downvote."""
        post = self.collection.find_one({'_id': ObjectId(post_id)})
        if not post:
            return False

        user_object_id = ObjectId(user_id)
        upvotes = post.get('upvotes', [])
        downvotes = post.get('downvotes', [])
        
        if user_object_id in downvotes:
            # Remove downvote
            result = self.collection.update_one(
                {'_id': ObjectId(post_id)},
                {
                    '$pull': {'downvotes': user_object_id},
                    '$inc': {'downvote_count': -1, 'score': 1},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return result.modified_count > 0
        else:
            # Remove from upvotes if present, then add downvote
            update_op = {
                '$addToSet': {'downvotes': user_object_id},
                '$inc': {'downvote_count': 1, 'score': -1},
                '$set': {'updated_at': datetime.utcnow()}
            }
            
            if user_object_id in upvotes:
                update_op['$pull'] = {'upvotes': user_object_id}
                update_op['$inc']['upvote_count'] = -1
                update_op['$inc']['score'] = -2  # -1 for downvote, -1 for removing upvote
            
            result = self.collection.update_one(
                {'_id': ObjectId(post_id)},
                update_op
            )
            return result.modified_count > 0

    def delete_post(self, post_id: str, deleted_by: str) -> bool:
        """Delete a post (soft delete)."""
        # Check if user has permission to delete this post
        post = self.get_post_by_id(post_id)
        if not post:
            return False

        # Check permissions - use Topic instead of Theme
        from .topic import Topic
        topic_model = Topic(self.db)
        topic_id = post.get('topic_id')
        if not topic_id:
            # Legacy support: try theme_id
            topic_id = post.get('theme_id')
        
        if topic_id:
            permission_level = topic_model.get_user_permission_level(topic_id, deleted_by)
        else:
            permission_level = 0

        # Owner and moderators can delete any post, users can delete their own
        if permission_level < 2 and post['user_id'] != deleted_by:
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {
                '$set': {
                    'is_deleted': True,
                    'deleted_by': ObjectId(deleted_by),
                    'deleted_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )

        if result.modified_count > 0 and topic_id:
            # Decrement topic post count
            topic_model.decrement_post_count(topic_id)

        return result.modified_count > 0

    def report_post(self, post_id: str, reporter_id: str, reason: str) -> bool:
        """Report a post for moderation."""
        post = self.get_post_by_id(post_id)
        if not post:
            return False

        # Check if user already reported this post
        existing_report = self.collection.find_one({
            '_id': ObjectId(post_id),
            'reports.reported_by': ObjectId(reporter_id)
        })

        if existing_report:
            return False  # Already reported

        report_data = {
            'reported_by': ObjectId(reporter_id),
            'reason': reason,
            'created_at': datetime.utcnow()
        }

        result = self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {'$push': {'reports': report_data}}
        )

        if result.modified_count > 0:
            # Create report entry in reports collection
            from .report import Report
            report_model = Report(self.db)
            topic_id = post.get('topic_id') or post.get('theme_id')  # Support both
            if topic_id:
                report_model.create_report(post_id, reporter_id, reason, topic_id, 'post')

        return result.modified_count > 0

    def increment_comment_count(self, post_id: str) -> None:
        """Increment the comment count for a post."""
        self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {'$inc': {'comment_count': 1}, '$set': {'updated_at': datetime.utcnow()}}
        )

    def decrement_comment_count(self, post_id: str) -> None:
        """Decrement the comment count for a post."""
        self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {'$inc': {'comment_count': -1}, '$set': {'updated_at': datetime.utcnow()}}
        )

    def _filter_content(self, content: str) -> str:
        """Filter post content for links and inappropriate content."""
        # Remove URLs/links
        url_pattern = r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?'
        content = re.sub(url_pattern, '[Link removed]', content, flags=re.IGNORECASE)

        # Basic profanity filtering (can be enhanced with external service)
        profanity_list = ['fuck', 'shit', 'cunt', 'bitch', 'asshole']  # Add more as needed
        words = content.split()
        for i, word in enumerate(words):
            if word.lower().strip('.,!?;:') in profanity_list:
                words[i] = '*' * len(word)
        content = ' '.join(words)

        return content.strip()

