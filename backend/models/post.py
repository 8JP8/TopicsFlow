from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
import re
from flask import current_app
from utils.cache_decorator import cache_result


class Post:
    """Post model for managing posts within topics (Reddit-style)."""

    def __init__(self, db):
        self.db = db
        self.collection = db.posts

    def create_post(self, topic_id: str, user_id: str, title: str, content: str,
                   anonymous_identity: Optional[str] = None,
                   gif_url: Optional[str] = None,
                   tags: Optional[List[str]] = None) -> str:
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
            'tags': tags or [],
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
        
        # Invalidate cache
        try:
            cache_invalidator = current_app.config.get('CACHE_INVALIDATOR')
            if cache_invalidator:
                cache_invalidator.invalidate_entity('post', post_id, topic_id=topic_id)
                cache_invalidator.invalidate_pattern('post:list:*')
        except Exception:
            pass  # Cache invalidation is optional

        return post_id

    @cache_result(ttl=300, key_prefix='post')
    def get_post_by_id(self, post_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get a specific post by ID."""
        post = self.collection.find_one({'_id': ObjectId(post_id)})
        if post:
            post['_id'] = str(post['_id'])
            post['id'] = str(post['_id'])
            post['topic_id'] = str(post['topic_id'])
            post['user_id'] = str(post['user_id'])
            
            # Convert upvotes and downvotes list ObjectIds to strings
            if 'upvotes' in post and post['upvotes']:
                post['upvotes'] = [str(u) for u in post['upvotes']]
            if 'downvotes' in post and post['downvotes']:
                post['downvotes'] = [str(u) for u in post['downvotes']]
            
            # Calculate score if not present
            if 'score' not in post:
                up_count = post.get('upvote_count', 0)
                down_count = post.get('downvote_count', 0)
                post['score'] = up_count - down_count
            
            # Check if user has upvoted, downvoted, or followed
            if user_id:
                post['user_has_upvoted'] = user_id in post.get('upvotes', [])
                post['user_has_downvoted'] = user_id in post.get('downvotes', [])

                # Check if followed
                from .notification_settings import NotificationSettings
                notif_settings = NotificationSettings(self.db)
                post['is_followed'] = notif_settings.is_following_post(user_id, post_id)
            else:
                post['user_has_upvoted'] = False
                post['user_has_downvoted'] = False
                post['is_followed'] = False

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
                post['profile_picture'] = None  # Explicitly set to None for anonymous
                post['is_admin'] = False
                post['is_owner'] = False
                post['is_moderator'] = False
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(post['user_id'])
                if user:
                    post['display_name'] = user['username']
                    post['author_username'] = user['username']
                    post['profile_picture'] = user.get('profile_picture')
                    post['is_admin'] = user.get('is_admin', False)
                    
                    # Check if owner or moderator of the topic
                    post['is_owner'] = False
                    post['is_moderator'] = False
                    if post.get('topic_id'):
                        from .topic import Topic
                        topic_model = Topic(self.db)
                        topic = topic_model.get_topic_by_id(str(post['topic_id']))
                        if topic:
                            post['is_owner'] = str(topic.get('owner_id')) == str(post['user_id'])
                            post['is_moderator'] = topic_model.is_user_moderator(str(post['topic_id']), str(post['user_id']))
                else:
                    post['display_name'] = 'Deleted User'
                    post['author_username'] = 'Deleted User'
                    post['profile_picture'] = None
                    post['is_admin'] = False
                    post['is_owner'] = False
                    post['is_moderator'] = False
                post['is_anonymous'] = False

        return post

    @cache_result(ttl=300, key_prefix='post')
    def get_posts_by_topic(self, topic_id: str, sort_by: str = 'new',
                          limit: int = 50, offset: int = 0,
                          user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get posts for a topic with sorting and pagination."""
        query = {
            'topic_id': ObjectId(topic_id),
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

        # Bulk fetch followed posts if user_id is provided
        followed_post_ids = set()
        if user_id:
            from .notification_settings import NotificationSettings
            notif_settings = NotificationSettings(self.db)
            followed_posts = notif_settings.get_followed_posts(user_id)
            followed_post_ids = {p['post_id'] for p in followed_posts}

        # Process posts
        for post in posts:
            post['_id'] = str(post['_id'])
            post['id'] = str(post['_id'])
            post['topic_id'] = str(post['topic_id'])
            post['user_id'] = str(post['user_id'])
            
            # Convert upvotes and downvotes list ObjectIds to strings
            if 'upvotes' in post and post['upvotes']:
                post['upvotes'] = [str(u) for u in post['upvotes']]
            if 'downvotes' in post and post['downvotes']:
                post['downvotes'] = [str(u) for u in post['downvotes']]
            
            # Calculate score if not present
            if 'score' not in post:
                up_count = post.get('upvote_count', 0)
                down_count = post.get('downvote_count', 0)
                post['score'] = up_count - down_count
            
            # Check if user has upvoted or downvoted
            if user_id:
                post['user_has_upvoted'] = user_id in post.get('upvotes', [])
                post['user_has_downvoted'] = user_id in post.get('downvotes', [])
                # Check if followed
                post['is_followed'] = post['id'] in followed_post_ids
            else:
                post['user_has_upvoted'] = False
                post['user_has_downvoted'] = False
                post['is_followed'] = False
            
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
                post['profile_picture'] = None  # Explicitly set to None for anonymous
                post['is_admin'] = False
                post['is_owner'] = False
                post['is_moderator'] = False
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(post['user_id'])
                if user:
                    post['display_name'] = user['username']
                    post['author_username'] = user['username']
                    post['profile_picture'] = user.get('profile_picture')
                    post['is_admin'] = user.get('is_admin', False)
                    
                    # Check if owner or moderator of the topic
                    post['is_owner'] = False
                    post['is_moderator'] = False
                    if post.get('topic_id'):
                        from .topic import Topic
                        topic_model = Topic(self.db)
                        topic = topic_model.get_topic_by_id(str(post['topic_id']))
                        if topic:
                            post['is_owner'] = str(topic.get('owner_id')) == str(post['user_id'])
                            post['is_moderator'] = topic_model.is_user_moderator(str(post['topic_id']), str(post['user_id']))
                else:
                    post['display_name'] = 'Deleted User'
                    post['author_username'] = 'Deleted User'
                    post['profile_picture'] = None
                    post['is_admin'] = False
                    post['is_owner'] = False
                    post['is_moderator'] = False
                post['is_anonymous'] = False

        return posts

    def get_recent_posts(self, limit: int = 20, offset: int = 0,
                        user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recent posts from all topics for the right sidebar."""
        query = {
            'is_deleted': False
        }

        # Sort by most recent
        sort_key = [('created_at', -1)]

        posts = list(self.collection.find(query)
                    .sort(sort_key)
                    .limit(limit)
                    .skip(offset))

        # Bulk fetch followed posts if user_id is provided
        followed_post_ids = set()
        if user_id:
            from .notification_settings import NotificationSettings
            notif_settings = NotificationSettings(self.db)
            followed_posts = notif_settings.get_followed_posts(user_id)
            followed_post_ids = {p['post_id'] for p in followed_posts}

        # Process posts (same as get_posts_by_topic)
        processed_posts = []
        for post in posts:
            # Check if topic_id exists before processing
            if 'topic_id' not in post:
                # Skip posts without topic_id (shouldn't happen, but handle gracefully)
                continue
                
            post['_id'] = str(post['_id'])
            post['id'] = str(post['_id'])
            post['topic_id'] = str(post['topic_id'])
            post['user_id'] = str(post['user_id'])
            
            # Convert upvotes and downvotes list ObjectIds to strings
            if 'upvotes' in post and post['upvotes']:
                post['upvotes'] = [str(u) for u in post['upvotes']]
            if 'downvotes' in post and post['downvotes']:
                post['downvotes'] = [str(u) for u in post['downvotes']]
            
            # Calculate score if not present
            if 'score' not in post:
                up_count = post.get('upvote_count', 0)
                down_count = post.get('downvote_count', 0)
                post['score'] = up_count - down_count
            
            # Check if user has upvoted or downvoted
            if user_id:
                post['user_has_upvoted'] = user_id in post.get('upvotes', [])
                post['user_has_downvoted'] = user_id in post.get('downvotes', [])
                # Check if followed
                post['is_followed'] = post['id'] in followed_post_ids
            else:
                post['user_has_upvoted'] = False
                post['user_has_downvoted'] = False
                post['is_followed'] = False
            
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
                post['profile_picture'] = None  # Explicitly set to None for anonymous
                post['is_admin'] = False
                post['is_owner'] = False
                post['is_moderator'] = False
            else:
                from .user import User
                user_model = User(self.db)
                user = user_model.get_user_by_id(post['user_id'])
                if user:
                    post['display_name'] = user['username']
                    post['author_username'] = user['username']
                    post['profile_picture'] = user.get('profile_picture')
                    post['is_admin'] = user.get('is_admin', False)
                    
                    # Check if owner or moderator of the topic
                    post['is_owner'] = False
                    post['is_moderator'] = False
                    if post.get('topic_id'):
                        from .topic import Topic
                        topic_model = Topic(self.db)
                        topic = topic_model.get_topic_by_id(str(post['topic_id']))
                        if topic:
                            post['is_owner'] = str(topic.get('owner_id')) == str(post['user_id'])
                            post['is_moderator'] = topic_model.is_user_moderator(str(post['topic_id']), str(post['user_id']))
                else:
                    post['display_name'] = 'Deleted User'
                    post['author_username'] = 'Deleted User'
                    post['profile_picture'] = None
                    post['is_admin'] = False
                    post['is_owner'] = False
                    post['is_moderator'] = False
                post['is_anonymous'] = False

            # Get topic title
            from .topic import Topic
            topic_model = Topic(self.db)
            topic = topic_model.get_topic_by_id(post['topic_id'])
            if topic:
                post['topic_title'] = topic.get('title', 'Unknown Topic')
            else:
                post['topic_title'] = 'Unknown Topic'
            
            processed_posts.append(post)

        return processed_posts

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
            if result.modified_count > 0:
                try:
                    cache_invalidator = current_app.config.get('CACHE_INVALIDATOR')
                    if cache_invalidator:
                        cache_invalidator.invalidate_entity('post', post_id)
                except Exception:
                    pass
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
            if result.modified_count > 0:
                try:
                    cache_invalidator = current_app.config.get('CACHE_INVALIDATOR')
                    if cache_invalidator:
                        cache_invalidator.invalidate_entity('post', post_id)
                except Exception:
                    pass
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

    def delete_post(self, post_id: str, deleted_by: str, mode: str = 'soft') -> bool:
        """Delete a post (soft or hard delete)."""
        # Check if user has permission to delete this post
        post = self.get_post_by_id(post_id)
        if not post:
            return False

        # Check permissions
        from .topic import Topic
        topic_model = Topic(self.db)
        topic_id = post.get('topic_id')

        if topic_id:
            permission_level = topic_model.get_user_permission_level(topic_id, deleted_by)
        else:
            return False  # No topic_id means invalid post

        # Owner and moderators can delete any post, users can delete their own
        is_owner = str(post['user_id']) == deleted_by
        if permission_level < 2 and not is_owner:
            return False

        if mode == 'hard':
            # Hard delete - remove from collection
            result = self.collection.delete_one({'_id': ObjectId(post_id)})
        else:
            # Soft delete - set is_deleted flag and pending status if owner
            from datetime import timedelta
            permanent_delete_at = datetime.utcnow() + timedelta(days=7) if is_owner else None
            deletion_status = 'pending' if is_owner else 'approved'

            result = self.collection.update_one(
                {'_id': ObjectId(post_id)},
                {
                    '$set': {
                        'is_deleted': True,
                        'deleted_by': ObjectId(deleted_by),
                        'deleted_at': datetime.utcnow(),
                        'permanent_delete_at': permanent_delete_at,
                        'deletion_status': deletion_status,
                        'updated_at': datetime.utcnow()
                    }
                }
            )

        if (result.deleted_count > 0 or result.modified_count > 0):
            # Invalidate cache
            try:
                cache_invalidator = current_app.config.get('CACHE_INVALIDATOR')
                if cache_invalidator:
                    cache_invalidator.invalidate_entity('post', post_id, topic_id=topic_id)
                    cache_invalidator.invalidate_pattern('post:list:*')
            except Exception:
                pass  # Cache invalidation is optional
            
            if topic_id:
                # Decrement topic post count
                topic_model.decrement_post_count(topic_id)

        return (result.deleted_count > 0 if mode == 'hard' else result.modified_count > 0)
    
    def get_pending_deletions(self) -> List[Dict[str, Any]]:
        """Get all posts pending deletion approval."""
        # First, update any deleted posts without deletion_status to 'pending' if owner deleted (backward compatibility)
        # Only update posts where deleted_by == user_id (owner deletion)
        self.collection.update_many(
            {
                'is_deleted': True,
                'deletion_status': {'$exists': False},
                '$expr': {'$eq': ['$deleted_by', '$user_id']}
            },
            {
                '$set': {
                    'deletion_status': 'pending'
                }
            }
        )
        
        # Find posts that are deleted and have deletion_status='pending'
        posts = list(self.collection.find({
            'is_deleted': True,
            'deletion_status': 'pending'
        }).sort([('deleted_at', -1)]))
        
        for post in posts:
            # Convert all ObjectIds to strings
            post['_id'] = str(post['_id'])
            post['id'] = str(post['_id'])
            post['user_id'] = str(post['user_id'])
            
            topic_id = post.get('topic_id')
            if topic_id:
                post['topic_id'] = str(topic_id) if isinstance(topic_id, ObjectId) else str(topic_id)
            else:
                post['topic_id'] = ''
            
            deleted_by = post.get('deleted_by')
            if deleted_by:
                post['deleted_by'] = str(deleted_by) if isinstance(deleted_by, ObjectId) else str(deleted_by)
            else:
                post['deleted_by'] = ''
            
            # Convert upvotes and downvotes lists
            if 'upvotes' in post and post['upvotes']:
                post['upvotes'] = [str(u) if isinstance(u, ObjectId) else u for u in post['upvotes']]
            if 'downvotes' in post and post['downvotes']:
                post['downvotes'] = [str(d) if isinstance(d, ObjectId) else d for d in post['downvotes']]
            
            # Convert datetime fields to ISO strings
            if 'created_at' in post and isinstance(post['created_at'], datetime):
                post['created_at'] = post['created_at'].isoformat()
            if 'updated_at' in post and isinstance(post.get('updated_at'), datetime):
                post['updated_at'] = post['updated_at'].isoformat()
            if 'deleted_at' in post and isinstance(post.get('deleted_at'), datetime):
                post['deleted_at'] = post['deleted_at'].isoformat()
            if 'permanent_delete_at' in post and isinstance(post.get('permanent_delete_at'), datetime):
                post['permanent_delete_at'] = post['permanent_delete_at'].isoformat()
            
            # Get owner details
            from .user import User
            user_model = User(self.db)
            owner = user_model.get_user_by_id(post['user_id'])
            if owner:
                post['owner'] = {
                    'id': str(owner['_id']),
                    'username': owner['username']
                }
        
        return posts
    
    def approve_post_deletion(self, post_id: str) -> bool:
        """Approve post deletion (admin only)."""
        result = self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {
                '$set': {
                    'deletion_status': 'approved'
                }
            }
        )
        return result.modified_count > 0
    
    def reject_post_deletion(self, post_id: str, lock_deletion: bool = False) -> bool:
        """Reject post deletion and restore it (admin only)."""
        update_data = {
            'is_deleted': False,
            'deleted_by': None,
            'deleted_at': None,
            'permanent_delete_at': None,
            'deletion_status': 'rejected',
            'updated_at': datetime.utcnow()
        }
        
        if lock_deletion:
            update_data['deletion_locked'] = True
            
        result = self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {'$set': update_data}
        )
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
            topic_id = post.get('topic_id')
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

    def close_post(self, post_id: str, reason: str) -> bool:
        """Close a post for comments."""
        result = self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {
                '$set': {
                    'status': 'closed',
                    'closure_reason': reason,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    def open_post(self, post_id: str) -> bool:
        """Re-open a closed post."""
        result = self.collection.update_one(
            {'_id': ObjectId(post_id)},
            {
                '$set': {
                    'status': 'open',
                    'closure_reason': '',
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

