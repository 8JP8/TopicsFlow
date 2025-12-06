"""
Script to fix corrupted friends collection indexes and remove null documents.
This script will:
1. Remove documents with null user_id or friend_id
2. Drop old indexes
3. Create correct indexes for from_user_id and to_user_id
"""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from bson import ObjectId
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_friends_collection(mongo_uri: str, db_name: str):
    """Fix friends collection by removing corrupted documents and fixing indexes."""
    try:
        client = MongoClient(mongo_uri)
        db = client[db_name]
        friends_collection = db.friends

        logger.info("Starting friends collection cleanup...")

        # Step 1: Remove documents with null user_id or friend_id
        logger.info("Removing documents with null user_id or friend_id...")
        result = friends_collection.delete_many({
            '$or': [
                {'user_id': None},
                {'friend_id': None},
                {'user_id': {'$exists': False}},
                {'friend_id': {'$exists': False}}
            ]
        })
        logger.info(f"Removed {result.deleted_count} corrupted documents")

        # Step 2: List all indexes
        logger.info("Current indexes:")
        for index in friends_collection.list_indexes():
            logger.info(f"  - {index['name']}: {index.get('key', {})}")

        # Step 3: Drop old indexes if they exist
        old_indexes = ['user_id_1_friend_id_1']
        for index_name in old_indexes:
            try:
                friends_collection.drop_index(index_name)
                logger.info(f"Dropped old index: {index_name}")
            except Exception as e:
                logger.info(f"Index {index_name} not found or already dropped: {e}")

        # Step 4: Create correct indexes for from_user_id and to_user_id
        logger.info("Creating correct indexes...")
        try:
            friends_collection.create_index(
                [('from_user_id', 1), ('to_user_id', 1)],
                unique=True,
                name='from_user_id_1_to_user_id_1'
            )
            logger.info("Created index: from_user_id_1_to_user_id_1")
        except Exception as e:
            logger.warning(f"Index creation failed (might already exist): {e}")

        try:
            friends_collection.create_index([('status', 1)])
            logger.info("Created index on status field")
        except Exception as e:
            logger.warning(f"Status index creation failed: {e}")

        # Step 5: Verify final state
        logger.info("\nFinal indexes:")
        for index in friends_collection.list_indexes():
            logger.info(f"  - {index['name']}: {index.get('key', {})}")

        logger.info("\nFriends collection cleanup completed successfully!")
        return True

    except Exception as e:
        logger.error(f"Error fixing friends collection: {e}", exc_info=True)
        return False


if __name__ == '__main__':
    import os
    from dotenv import load_dotenv

    load_dotenv()

    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
    db_name = os.getenv('MONGO_DB_NAME', 'chatapp')

    logger.info(f"Connecting to MongoDB: {mongo_uri}")
    logger.info(f"Database: {db_name}")

    success = fix_friends_collection(mongo_uri, db_name)
    sys.exit(0 if success else 1)

