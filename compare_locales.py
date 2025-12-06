
import json

def get_keys(obj, prefix=''):
    keys = set()
    for k, v in obj.items():
        if isinstance(v, dict):
            keys.update(get_keys(v, f"{prefix}{k}."))
        else:
            keys.add(f"{prefix}{k}")
    return keys

def compare_locales():
    with open(r'c:\Users\JP\OneDrive - Instituto Superior de Engenharia do Porto\RINTE\ChatHub_App\frontend\locales\en.json', 'r', encoding='utf-8') as f:
        en = json.load(f)
    with open(r'c:\Users\JP\OneDrive - Instituto Superior de Engenharia do Porto\RINTE\ChatHub_App\frontend\locales\pt.json', 'r', encoding='utf-8') as f:
        pt = json.load(f)

    en_keys = get_keys(en)
    pt_keys = get_keys(pt)

    missing_in_en = pt_keys - en_keys
    missing_in_pt = en_keys - pt_keys

    print("Missing in EN:")
    for k in sorted(missing_in_en):
        print(k)

    print("\nMissing in PT:")
    for k in sorted(missing_in_pt):
        print(k)

if __name__ == "__main__":
    compare_locales()
