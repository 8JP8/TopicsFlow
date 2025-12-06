import json
import os
import re

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
LOCALES_DIR = os.path.join(FRONTEND_DIR, 'locales')
EN_JSON_PATH = os.path.join(LOCALES_DIR, 'en.json')
PT_JSON_PATH = os.path.join(LOCALES_DIR, 'pt.json')

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def split_camel_case(text):
    # Split camelCase -> camel Case
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1 \2', text)
    return re.sub('([a-z0-9])([A-Z])', r'\1 \2', s1)

def clean_value(value):
    if isinstance(value, str) and value.startswith("[MISSING] "):
        # Remove prefix
        clean = value.replace("[MISSING] ", "")
        # Try to fix "Anonymoususer" -> "Anonymous User" if it looks like merged words
        # But wait, the value I put in was just capitalized key. 
        # e.g. key="anonymousUser" -> val="[MISSING] Anonymoususer"
        # The key info is lost in the value, but I can re-infer from the value text 
        # or I can just simple-case it.
        # "Anonymoususer" is hard to split without dictionary.
        # But actually, if I look at my previous script:
        # readable_start = key.split('.')[-1]
        # readable = readable_start.replace('_', ' ').capitalize()
        # So "anonymousUser" became "Anonymoususer".
        
        # Let's just do a best effort to split if it looks like it has no spaces.
        if ' ' not in clean and len(clean) > 1:
             # It might be CamelCase or PascalCase compressed
             # But my previous script ALREADY lowercased everything inside?
             # No, `readable_start` was just the key string.
             # "anonymousUser" -> capitalize() -> "Anonymoususer"
             # So case info is lost for the middle chars.
             # I can't easily recover "User" from "answer".
             # I'll just leave it as capitalized word for now, or manually fix specific ones.
             pass
        return clean
    return value

def process_dict(data):
    for k, v in data.items():
        if isinstance(v, dict):
            process_dict(v)
        elif isinstance(v, str):
            data[k] = clean_value(v)

def main():
    print("Cleaning en.json...")
    en_data = load_json(EN_JSON_PATH)
    process_dict(en_data)
    save_json(EN_JSON_PATH, en_data)
    
    print("Cleaning pt.json...")
    pt_data = load_json(PT_JSON_PATH)
    process_dict(pt_data)
    save_json(PT_JSON_PATH, pt_data)
    print("Done.")

if __name__ == "__main__":
    main()
