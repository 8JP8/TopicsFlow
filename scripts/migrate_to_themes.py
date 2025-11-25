#!/usr/bin/env python3
"""
Migration script to convert Topics to Themes and create Posts from old messages.

This script:
1. Converts all existing Topics to Themes
2. Creates Posts from old topic messages (first message becomes a post, others become comments)
3. Creates default chat rooms for each migrated theme
4. Preserves all existing data (users, private messages, friends, etc.)
"""

import sys
import os
from datetime import datetime, timezone
from bson import ObjectId

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(env_path)
load_dotenv()  # Also try project root

def migrate_topics_to_themes():
    """Convert all Topics to Themes."""
    print("Starting migration: Topics -> Themes")
    
    # Get MongoDB connection from environment
    # Try multiple environment variable names for compatibility
    mongodb_uri = (
        os.getenv('DATABASE_URL') or 
        os.getenv('MONGODB_URI') or 
        os.getenv('MONGO_URI') or
        'mongodb://localhost:27017/chatapp'
    )
    mongodb_db = (
        os.getenv('DB_NAME') or 
        os.getenv('MONGODB_DB_NAME') or 
        os.getenv('MONGO_DB_NAME') or
        'chatapp'
    )
    
    # Connect to MongoDB
    client = MongoClient(mongodb_uri)
    db = client[mongodb_db]
    
    topics_collection = db.topics
    themes_collection = db.themes
    messages_collection = db.messages
    posts_collection = db.posts
    comments_collection = db.comments
    chat_rooms_collection = db.chat_rooms
    
    # Get all topics
    topics = list(topics_collection.find({}))
    print(f"Found {len(topics)} topics to migrate")
    
    migrated_count = 0
    posts_created = 0
    chat_rooms_created = 0
    
    for topic in topics:
        try:
            # Check if theme already exists
            existing_theme = themes_collection.find_one({'title': topic.get('title')})
            if existing_theme:
                print(f"  Theme '{topic.get('title')}' already exists, skipping...")
                continue
            
            # Create theme from topic
            theme_data = {
                'title': topic.get('title', 'Untitled Theme'),
                'description': topic.get('description', ''),
                'tags': topic.get('tags', []),
                'owner_id': topic.get('owner_id'),
                'members': topic.get('members', []),
                'member_count': topic.get('member_count', 0),
                'post_count': 0,
                'last_activity': topic.get('last_activity', datetime.now(timezone.utc)),
                'moderators': topic.get('moderators', []),
                'banned_users': topic.get('banned_users', []),
                'settings': topic.get('settings', {
                    'allow_anonymous': True,
                    'require_approval': False,
                }),
                'created_at': topic.get('created_at', datetime.now(timezone.utc)),
                'updated_at': datetime.now(timezone.utc),
            }
            
            theme_result = themes_collection.insert_one(theme_data)
            theme_id = theme_result.inserted_id
            print(f"  Created theme: {theme_data['title']} (ID: {theme_id})")
            migrated_count += 1
            
            # Get messages for this topic
            topic_messages = list(messages_collection.find({
                'topic_id': topic['_id'],
                'is_deleted': False,
            }).sort('created_at', 1))
            
            if topic_messages:
                # First message becomes a post
                first_message = topic_messages[0]
                post_data = {
                    'theme_id': theme_id,
                    'user_id': first_message.get('user_id'),
                    'title': f"Post from {topic.get('title', 'Topic')}",
                    'content': first_message.get('content', ''),
                    'anonymous_identity': first_message.get('anonymous_identity'),
                    'gif_url': first_message.get('gif_url'),
                    'upvotes': [],
                    'upvote_count': 0,
                    'comment_count': len(topic_messages) - 1,
                    'is_deleted': False,
                    'created_at': first_message.get('created_at', datetime.now(timezone.utc)),
                    'updated_at': datetime.now(timezone.utc),
                }
                
                post_result = posts_collection.insert_one(post_data)
                post_id = post_result.inserted_id
                posts_created += 1
                print(f"    Created post from first message (ID: {post_id})")
                
                # Remaining messages become comments
                for idx, message in enumerate(topic_messages[1:], start=1):
                    comment_data = {
                        'post_id': post_id,
                        'user_id': message.get('user_id'),
                        'content': message.get('content', ''),
                        'parent_comment_id': None,
                        'anonymous_identity': message.get('anonymous_identity'),
                        'gif_url': message.get('gif_url'),
                        'upvotes': [],
                        'upvote_count': 0,
                        'reply_count': 0,
                        'depth': 0,
                        'is_deleted': False,
                        'created_at': message.get('created_at', datetime.now(timezone.utc)),
                        'updated_at': datetime.now(timezone.utc),
                    }
                    
                    comments_collection.insert_one(comment_data)
                    print(f"      Created comment {idx} from message")
                
                # Update post comment count
                posts_collection.update_one(
                    {'_id': post_id},
                    {'$set': {'comment_count': len(topic_messages) - 1}}
                )
                
                # Update theme post count
                themes_collection.update_one(
                    {'_id': theme_id},
                    {'$inc': {'post_count': 1}}
                )
            
            # Create default chat room for the theme
            chat_room_data = {
                'theme_id': theme_id,
                'name': f"{topic.get('title', 'General')} Chat",
                'description': f"General chat room for {topic.get('title', 'theme')}",
                'owner_id': topic.get('owner_id'),
                'members': topic.get('members', []),
                'member_count': topic.get('member_count', 0),
                'message_count': 0,
                'is_public': True,
                'created_at': datetime.now(timezone.utc),
                'last_activity': topic.get('last_activity', datetime.now(timezone.utc)),
            }
            
            chat_room_result = chat_rooms_collection.insert_one(chat_room_data)
            chat_rooms_created += 1
            print(f"    Created default chat room (ID: {chat_room_result.inserted_id})")
            
        except Exception as e:
            print(f"  ERROR migrating topic {topic.get('_id')}: {str(e)}")
            import traceback
            traceback.print_exc()
            continue
    
    print(f"\nMigration complete!")
    print(f"  Themes created: {migrated_count}")
    print(f"  Posts created: {posts_created}")
    print(f"  Chat rooms created: {chat_rooms_created}")
    print(f"\nNote: Original topics and messages are preserved for backward compatibility.")
    
    client.close()

if __name__ == '__main__':
    print("=" * 60)
    print("TopicsFlow Migration Script")
    print("Converting Topics to Themes")
    print("=" * 60)
    print()
    
    response = input("This will create new Themes, Posts, Comments, and Chat Rooms.\n"
                    "Original Topics and Messages will be preserved.\n"
                    "Continue? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        migrate_topics_to_themes()
    else:
        print("Migration cancelled.")

