import json
import os
from collections import OrderedDict

# Missing keys to inject
MISSING_KEYS_PT = {
    "invitations": {
        "invitesForTopicChats": "Convites para Chats do Tópico #{{topic}}",
        "filterByTopic": "Filtrar por Tópico",
        "noTopicsFound": "Nenhum tópico encontrado",
        "invitesForTopic": "Convites para o Tópico #{{topic}}",
        "topicInvites": "Convites para Tópicos"
    }
}

MISSING_KEYS_EN = {
    "invitations": {
        "invitesForTopicChats": "Invitations for Chat Rooms in Topic #{{topic}}",
        "filterByTopic": "Filter by Topic",
        "noTopicsFound": "No topics found",
        "invitesForTopic": "Invitations for Topic #{{topic}}",
        "topicInvites": "Topic Invitations"
    }
}

def deep_merge(target, source):
    """
    Recursively merges source dict into target dict.
    """
    for key, value in source.items():
        if key in target and isinstance(target[key], dict) and isinstance(value, dict):
            deep_merge(target[key], value)
        else:
            # For non-dict values (or if key doesn't exist), set/overwrite
            # But wait, if we have duplicate keys in the file, we want to specific logic.
            # This function is for merging the MISSING_KEYS into the result.
            target[key] = value
    return target

def merge_duplicates_hook(ordered_pairs):
    """
    Custom hook to handle duplicate keys by merging dictionaries.
    """
    d = OrderedDict()
    for k, v in ordered_pairs:
        if k in d:
            if isinstance(d[k], dict) and isinstance(v, dict):
                deep_merge(d[k], v)
            else:
                # If content is identical, it's fine. If different, we might overwrite.
                # In the case of pt.json syntax error (duplicates), we likely want to keep the union.
                # But simple overwrites for strings are usually fine if they match or latest is better.
                d[k] = v 
        else:
            d[k] = v
    return d

def process_file(file_path, missing_data):
    print(f"Processing {file_path}...")
    
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            # Load with custom hook to merge duplicate keys found IN THE FILE itself
            data = json.load(f, object_pairs_hook=merge_duplicates_hook)
        
        # Merge our new missing keys into the cleaned data
        deep_merge(data, missing_data)

        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully updated {file_path}")
        
    except json.JSONDecodeError as e:
        print(f"JSON Error in {file_path}: {e}")
        # Build a robust recovery if it fails? 
        # The user mentioned "syntax error" in previous turn. 
        # Standard json.load might fail if commas are missing, but handles duplicates if hook is used (sometimes).
        # Actually, standard json.load might fail on "End of file expected" if there are multiple root objects.
        # If the file resembles: { ... } { ... } (concatenated JSONs), json.load fails.
        # Let's handle the specific "End of file expected" case roughly:
        fix_concatenated_json(file_path, missing_data)

def fix_concatenated_json(file_path, missing_data):
    print("Attempting to fix potentially concatenated JSON...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Naive fix: wrapper to make it a list? No, we want to merge them.
    # We can try to regex split '}\s*{' or just use a raw parser loop.
    decoder = json.JSONDecoder(object_pairs_hook=merge_duplicates_hook)
    idx = 0
    merged_data = OrderedDict()
    
    while idx < len(content):
        # specific skip whitespace
        while idx < len(content) and content[idx].isspace():
            idx += 1
        if idx >= len(content):
            break
            
        try:
            obj, end_idx = decoder.raw_decode(content, idx)
            deep_merge(merged_data, obj)
            idx = end_idx
        except json.JSONDecodeError:
            print("Could not decode further sections.")
            break
            
    # Now merge our missing keys
    deep_merge(merged_data, missing_data)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, indent=2, ensure_ascii=False)
    print("Fixed and merged.")


base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pt_path = os.path.join(base_dir, 'frontend', 'locales', 'pt.json')
en_path = os.path.join(base_dir, 'frontend', 'locales', 'en.json')

process_file(pt_path, MISSING_KEYS_PT)
process_file(en_path, MISSING_KEYS_EN)
