import json
import os

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def find_missing_keys(base, target, path=""):
    missing = []
    for key, value in base.items():
        current_path = f"{path}.{key}" if path else key
        if key not in target:
            missing.append(current_path)
        elif isinstance(value, dict) and isinstance(target[key], dict):
            missing.extend(find_missing_keys(value, target[key], current_path))
    return missing

base_path = r"c:\Users\JP\OneDrive - Instituto Superior de Engenharia do Porto\RINTE\TopicsFlow_App\frontend\locales\en.json"
target_path = r"c:\Users\JP\OneDrive - Instituto Superior de Engenharia do Porto\RINTE\TopicsFlow_App\frontend\locales\pt.json"

try:
    en_data = load_json(base_path)
    pt_data = load_json(target_path)
    
    missing_keys = find_missing_keys(en_data, pt_data)
    
    if missing_keys:
        print("Missing keys in pt.json:")
        for key in missing_keys:
            print(key)
    else:
        print("No missing keys found!")
        
except Exception as e:
    print(f"Error: {e}")
