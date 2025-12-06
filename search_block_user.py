#!/usr/bin/env python3
import os
import re

backend_dir = r"C:\Users\JP\OneDrive - Instituto Superior de Engenharia do Porto\RINTE\ChatHub_App\backend"

pattern = r"def block_user\("

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines, 1):
                        if 'def block_user' in line:
                            print(f"{filepath}:{i}: {line.strip()}")
            except:
                pass
