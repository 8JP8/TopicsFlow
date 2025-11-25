from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
import re


class Comment:
    """Comment model for managing comments and replies on posts (Reddit-style nested comments)."""

    def __init__(self, db):
        self.db = db
        self.collection = db.comments

    def create_comment(self, post_id: str, user_id: str, content: str,
                      parent_comment_id: Optional[str] = None,
                      anonymous_identity: Optional[str] = None,
                      gif_url: Optional[str] = None) -> str:
        """Create a new comment on a post or as a reply to another comment."""
        # Validate and filter content
        filtered_content = self._filter_content(content)

        comment_data = {
            'post_id': ObjectId(post_id),
            'user_id': ObjectId(user_id),
            'content': filtered_content,
            'parent_comment_id': ObjectId(parent_comment_id) if parent_comment_id else None,
            'anonymous_identity': anonymous_identity,
            'gif_url': gif_url,
            'upvotes': [],  # Array of user_ids who upvoted
            'upvote_count': 0,
            'reply_count': 0,
            'depth': 0,  # Depth in comment tree (0 = top-level comment)
            'is_deleted': False,
            'deleted_by': None,
            'deleted_at': None,
            'reports': [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        # Calculate depth if this is a reply
        if parent_comment_id:
            parent = self.collection.find_one({'_id': ObjectId(parent_comment_id)})
            if parent:
                comment_data['depth'] = parent.get('depth', 0) + 1
                # Limit depth to prevent too deep nesting (max 10 levels)
                if comment_data['depth'] > 10:
                    comment_data['depth'] = 10

        result = self.collection.insert_one(comment_data)
        comment_id = str(result.inserted_id)
        
        # Process mentions in content
        from utils.mention_parser import process_mentions_in_content
        mentioned_user_ids = process_mentions_in_content(
            db=self.db,
            content=filtered_content,
            content_id=comment_id,
            content_type='comment',
            sender_id=user_id,
            context={'post_id': post_id, 'comment_id': comment_id, 'parent_comment_id': parent_comment_id}
        )
        
        # Update comment with mentions if any
        if mentioned_user_ids:
            self.collection.update_one(
                {'_id': ObjectId(comment_id)},
                {'$set': {'mentions': mentioned_user_ids}}
            )
        
        # Update post comment count
        from .post import Post
        post_model = Post(self.db)
        post_model.increment_comment_count(post_id)

        # If this is a reply, increment parent comment's reply count
        if parent_comment_id:
            self.collection.update_one(
                {'_id': ObjectId(parent_comment_id)},
                {'$inc': {'reply_count': 1}}
            )

        return comment_id

    def get_comment_by_id(self, comment_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific comment by ID."""
        comment = self.collection.find_one({'_id': ObjectId(comment_id)})
        if comment:
            comment['_id'] = str(comment['_id'])
            comment['id'] = str(comment['_id'])
            comment['post_id'] = str(comment['post_id'])
            comment['user_id'] = str(comment['user_id'])
            
            if comment.get('parent_comment_id'):
                comment['parent_comment_id'] = str(comment['parent_comment_id'])
            
            # Convert upvotes list ObjectIds to strings
            if 'upvotes' in comment and comment['upvotes']:
                comment['upvotes'] = [str(user_id) for user_id in comment['upvotes']]
            
            # Convert datetime to ISO string
            if 'created_at' in comment and isinstance(comment['created_at'], datetime):
                comment['created_at'] = comment['created_at'].isoformat()
            if 'updated_at' in comment and isinstance(comment['updated_at'], datetime):
                comment['updated_at'] = comment['updated_at'].isoformat()
            
            # Get user details (or anonymous identity)
            if comment.get('anonymous_identity'):
                comment['display_name'] = comment['anonymous_identity']
                comment['is_anonymous'] = True
                comment['author_username'] = comment['anonymous_identity']
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(comment['user_id'])
                if user:
                    comment['display_name'] = user['username']
                    comment['author_username'] = user['username']
                else:
                    comment['display_name'] = 'Deleted User'
                    comment['author_username'] = 'Deleted User'
                comment['is_anonymous'] = False

        return comment

    def get_comments_by_post(self, post_id: str, sort_by: str = 'top',
                            limit: int = 100, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all comments for a post, organized as a tree structure."""
        query = {
            'post_id': ObjectId(post_id),
            'is_deleted': False
        }

        # Determine sort order
        if sort_by == 'new':
            sort_key = [('created_at', -1)]
        elif sort_by == 'old':
            sort_key = [('created_at', 1)]
        else:  # default: 'top' (by upvotes)
            sort_key = [('upvote_count', -1), ('created_at', -1)]

        comments = list(self.collection.find(query)
                       .sort(sort_key)
                       .limit(limit))

        # Process comments and build tree structure
        comments_dict = {}
        root_comments = []

        for comment in comments:
            comment['_id'] = str(comment['_id'])
            comment['id'] = str(comment['_id'])
            comment['post_id'] = str(comment['post_id'])
            comment['user_id'] = str(comment['user_id'])
            
            if comment.get('parent_comment_id'):
                comment['parent_comment_id'] = str(comment['parent_comment_id'])
            
            # Convert upvotes list ObjectIds to strings
            if 'upvotes' in comment and comment['upvotes']:
                comment['upvotes'] = [str(user_id) for user_id in comment['upvotes']]
            
            # Check if user has upvoted
            if user_id:
                comment['user_has_upvoted'] = ObjectId(user_id) in comment.get('upvotes', [])
            else:
                comment['user_has_upvoted'] = False
            
            # Convert datetime to ISO string
            if 'created_at' in comment and isinstance(comment['created_at'], datetime):
                comment['created_at'] = comment['created_at'].isoformat()
            if 'updated_at' in comment and isinstance(comment['updated_at'], datetime):
                comment['updated_at'] = comment['updated_at'].isoformat()
            
            # Get user details (or anonymous identity)
            if comment.get('anonymous_identity'):
                comment['display_name'] = comment['anonymous_identity']
                comment['is_anonymous'] = True
                comment['author_username'] = comment['anonymous_identity']
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(comment['user_id'])
                if user:
                    comment['display_name'] = user['username']
                    comment['author_username'] = user['username']
                else:
                    comment['display_name'] = 'Deleted User'
                    comment['author_username'] = 'Deleted User'
                comment['is_anonymous'] = False

            # Initialize replies list
            comment['replies'] = []
            comments_dict[comment['id']] = comment

        # Build tree structure
        for comment_id, comment in comments_dict.items():
            if comment.get('parent_comment_id') and comment['parent_comment_id'] in comments_dict:
                # This is a reply, add it to parent's replies
                parent = comments_dict[comment['parent_comment_id']]
                parent['replies'].append(comment)
            else:
                # This is a root comment
                root_comments.append(comment)

        return root_comments

    def upvote_comment(self, comment_id: str, user_id: str) -> bool:
        """Upvote a comment (toggle - if already upvoted, remove upvote)."""
        comment = self.collection.find_one({'_id': ObjectId(comment_id)})
        if not comment:
            return False

        user_object_id = ObjectId(user_id)
        upvotes = comment.get('upvotes', [])
        
        if user_object_id in upvotes:
            # Remove upvote
            result = self.collection.update_one(
                {'_id': ObjectId(comment_id)},
                {
                    '$pull': {'upvotes': user_object_id},
                    '$inc': {'upvote_count': -1},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return result.modified_count > 0
        else:
            # Add upvote
            result = self.collection.update_one(
                {'_id': ObjectId(comment_id)},
                {
                    '$addToSet': {'upvotes': user_object_id},
                    '$inc': {'upvote_count': 1},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            return result.modified_count > 0

    def delete_comment(self, comment_id: str, deleted_by: str) -> bool:
        """Delete a comment (soft delete)."""
        comment = self.get_comment_by_id(comment_id)
        if not comment:
            return False

        # Check permissions
        from .post import Post
        from .topic import Topic
        post_model = Post(self.db)
        post = post_model.get_post_by_id(comment['post_id'])
        
        if not post:
            return False

        # Use Topic instead of Theme for permissions
        topic_model = Topic(self.db)
        topic_id = post.get('topic_id')
        if not topic_id:
            # Legacy support: try theme_id
            topic_id = post.get('theme_id')
        
        if topic_id:
            permission_level = topic_model.get_user_permission_level(topic_id, deleted_by)
        else:
            permission_level = 0

        # Owner and moderators can delete any comment, users can delete their own
        if permission_level < 2 and comment['user_id'] != deleted_by:
            return False

        result = self.collection.update_one(
            {'_id': ObjectId(comment_id)},
            {
                '$set': {
                    'is_deleted': True,
                    'deleted_by': ObjectId(deleted_by),
                    'deleted_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )

        if result.modified_count > 0:
            # Decrement post comment count
            post_model.decrement_comment_count(comment['post_id'])

            # If this is a reply, decrement parent comment's reply count
            if comment.get('parent_comment_id'):
                self.collection.update_one(
                    {'_id': ObjectId(comment['parent_comment_id'])},
                    {'$inc': {'reply_count': -1}}
                )

        return result.modified_count > 0

    def report_comment(self, comment_id: str, reporter_id: str, reason: str) -> bool:
        """Report a comment for moderation."""
        comment = self.get_comment_by_id(comment_id)
        if not comment:
            return False

        # Check if user already reported this comment
        existing_report = self.collection.find_one({
            '_id': ObjectId(comment_id),
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
            {'_id': ObjectId(comment_id)},
            {'$push': {'reports': report_data}}
        )

        if result.modified_count > 0:
            # Create report entry in reports collection
            from .post import Post
            from .report import Report
            post_model = Post(self.db)
            post = post_model.get_post_by_id(comment['post_id'])
            
            if post:
                report_model = Report(self.db)
                report_model.create_report(comment_id, reporter_id, reason, post['theme_id'], 'comment')

        return result.modified_count > 0

    def _filter_content(self, content: str) -> str:
        """Filter comment content for links and inappropriate content."""
        # Remove URLs/links
        url_pattern = r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?'
        content = re.sub(url_pattern, '[Link removed]', content, flags=re.IGNORECASE)

        # Basic profanity filtering
        profanity_list = ['fuck', 'shit', 'cunt', 'bitch', 'asshole']
        words = content.split()
        for i, word in enumerate(words):
            if word.lower().strip('.,!?;:') in profanity_list:
                words[i] = '*' * len(word)
        content = ' '.join(words)

        return content.strip()

