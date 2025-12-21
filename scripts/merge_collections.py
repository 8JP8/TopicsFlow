import json
import os
import shutil
from datetime import datetime

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOPICSFLOW_COLLECTION_PATH = os.path.join(BASE_DIR, 'TopicsFlow_API.postman_collection.json')
BACKEND_API_COLLECTION_PATH = os.path.join(BASE_DIR, 'tests', 'postman', 'TopicsFlow_Backend_API.postman_collection.json')
OUTPUT_PATH = os.path.join(BASE_DIR, 'tests', 'TopicsFlow_API.postman_collection.json')

def load_json(path):
    if not os.path.exists(path):
        print(f"Error: File not found at {path}")
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return None

def merge_collections():
    print(f"Loading collections...")
    topics_flow = load_json(TOPICSFLOW_COLLECTION_PATH)
    backend_api = load_json(BACKEND_API_COLLECTION_PATH)

    if not topics_flow or not backend_api:
        print("Aborting merge due to missing files.")
        return

    # Use backend_api as the base because it has the detailed test suite
    merged = backend_api.copy()
    
    # Update Info
    merged['info']['name'] = "TopicsFlow API - Complete Collection"
    merged['info']['_postman_id'] = "topicsflow-complete-api-merged"
    merged['info']['description'] = f"Complete API collection for TopicsFlow. Merged from TopicsFlow_Backend_API and TopicsFlow_API on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}."

    # Create a set of existing request names/IDs in the base collection to avoid duplicates
    existing_items = set()
    
    def extract_names(items):
        for item in items:
            if 'name' in item:
                existing_items.add(item['name'])
            if 'item' in item:
                extract_names(item['item'])
    
    if 'item' in merged:
        extract_names(merged['item'])

    print(f"Found {len(existing_items)} existing items in base collection.")

    # Function to recursively find unique items in the source collection
    items_to_add = []
    
    def find_unique_items(items):
        unique = []
        for item in items:
            if 'name' in item and item['name'] not in existing_items:
                unique.append(item)
            elif 'item' in item:
                # If it's a folder, check its children
                # Simplification: If folder name exists, we might want to merge contents, 
                # but for now let's just add top-level unique items or unique folders.
                # If folder exists, we could check children, but deep merging is complex. 
                # Let's assume if the top level name is different, it's a different feature.
                if item['name'] not in existing_items:
                     unique.append(item)
        return unique

    if 'item' in topics_flow:
        new_items = find_unique_items(topics_flow['item'])
        if new_items:
            print(f"Adding {len(new_items)} new top-level items from TopicsFlow collection.")
            merged['item'].extend(new_items)
        else:
            print("No new top-level items found to add.")
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # Save merged collection
    try:
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(merged, f, indent=4)
        print(f"Successfully created merged collection at: {OUTPUT_PATH}")
    except Exception as e:
        print(f"Error saving merged collection: {e}")

if __name__ == "__main__":
    merge_collections()
