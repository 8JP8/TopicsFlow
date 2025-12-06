#!/usr/bin/env python3
"""
Script to fix the anonymous_identities collection index issue.
This script removes the incorrect index with theme_id and ensures the correct index with topic_id exists.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from pymongo.errors import OperationFailure

def fix_anonymous_identities_index():
    """Fix the anonymous_identities collection indexes."""
    app = create_app()
    
    with app.app_context():
        db = app.db
        collection = db.anonymous_identities
        
        print("Checking anonymous_identities indexes...")
        
        # Get all indexes
        indexes = collection.list_indexes()
        index_names = []
        for idx in indexes:
            index_names.append(idx['name'])
            print(f"Found index: {idx['name']} - {idx.get('key', {})}")
        
        # Drop incorrect index if it exists
        if 'user_id_1_theme_id_1' in index_names:
            print("\nDropping incorrect index: user_id_1_theme_id_1")
            try:
                collection.drop_index('user_id_1_theme_id_1')
                print("✓ Dropped incorrect index")
            except Exception as e:
                print(f"✗ Error dropping index: {e}")
        
        # Ensure correct index exists
        print("\nCreating/ensuring correct index: user_id + topic_id")
        try:
            collection.create_index(
                [("user_id", 1), ("topic_id", 1)],
                unique=True,
                name="user_id_1_topic_id_1"
            )
            print("✓ Correct index created/verified")
        except Exception as e:
            if 'already exists' in str(e).lower() or 'E11000' in str(e):
                print("✓ Correct index already exists")
            else:
                print(f"✗ Error creating index: {e}")
        
        # Clean up any documents with theme_id instead of topic_id (if any)
        print("\nChecking for documents with theme_id field...")
        theme_id_docs = list(collection.find({'theme_id': {'$exists': True}}))
        if theme_id_docs:
            print(f"Found {len(theme_id_docs)} documents with theme_id field")
            for doc in theme_id_docs:
                if 'theme_id' in doc and 'topic_id' not in doc:
                    print(f"  - Document {doc['_id']} has theme_id but no topic_id - needs manual review")
        else:
            print("✓ No documents with theme_id field found")
        
        print("\n✓ Index fix complete!")

if __name__ == '__main__':
    fix_anonymous_identities_index()

