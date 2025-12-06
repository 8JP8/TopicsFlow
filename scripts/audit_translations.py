import re
import os
import json

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
LOCALES_DIR = os.path.join(FRONTEND_DIR, 'locales')
EN_JSON_PATH = os.path.join(LOCALES_DIR, 'en.json')
PT_JSON_PATH = os.path.join(LOCALES_DIR, 'pt.json')

def load_json(path):
    if not os.path.exists(path):
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def dict_to_flat_keys(data, prefix=""):
    keys = set()
    for k, v in data.items():
        if isinstance(v, dict):
            keys.update(dict_to_flat_keys(v, f"{prefix}{k}."))
        else:
            keys.add(f"{prefix}{k}")
    return keys

def add_key_to_dict(data, key_path, value="MISSING_TRANSLATION"):
    keys = key_path.split('.')
    current = data
    for i, k in enumerate(keys[:-1]):
        if k not in current:
            current[k] = {}
        if not isinstance(current[k], dict):
             # Conflict: existing key is a string, but new key needs it to be a dict
             # e.g., 'auth' is "Auth" string, but we need 'auth.login'
             # This is tricky. For now, let's print a warning and skip or rename.
             print(f"WARNING: Conflict at '{k}' in path '{key_path}'. Existing value is not a dict.")
             return
        current = current[k]
    
    last_key = keys[-1]
    if last_key not in current:
        current[last_key] = value

def scan_frontend():
    found_keys = set()
    # Regex to capture t('key.path') or t("key.path")
    # Supports strict t('...') usage as seen in code
    pattern = re.compile(r"""t\(\s*['"]([\w\.]+)['"]\s*\)""")
    
    print(f"Scanning {FRONTEND_DIR}...")
    for root, _, files in os.walk(FRONTEND_DIR):
        if 'node_modules' in root or '.next' in root:
            continue
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.jsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        matches = pattern.findall(content)
                        for match in matches:
                            found_keys.add(match)
                except Exception as e:
                    print(f"Error reading {path}: {e}")
    
    return found_keys

def audit():
    used_keys = scan_frontend()
    print(f"Found {len(used_keys)} unique translation keys used in code.")

    en_data = load_json(EN_JSON_PATH)
    pt_data = load_json(PT_JSON_PATH)

    en_flat = dict_to_flat_keys(en_data)
    
    missing_keys = []
    for key in used_keys:
        if key not in en_flat:
            missing_keys.append(key)
    
    print(f"Missing keys in en.json: {len(missing_keys)}")
    
    if missing_keys:
        print("Adding missing keys...")
        for key in missing_keys:
            # Generate a readable value from the key
            # e.g., 'home.title' -> 'Title' (simplification) or just the key
            readable_start = key.split('.')[-1]
            readable = readable_start.replace('_', ' ').capitalize()
            
            add_key_to_dict(en_data, key, f"[MISSING] {readable}")
            add_key_to_dict(pt_data, key, f"[MISSING] {readable}")
        
        save_json(EN_JSON_PATH, en_data)
        save_json(PT_JSON_PATH, pt_data)
        print("Updated en.json and pt.json")
    else:
        print("No missing keys found!")

if __name__ == "__main__":
    audit()
