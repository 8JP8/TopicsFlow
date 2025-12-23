#!/usr/bin/env python3
"""
Utility script to resize the 512x512px icon into different sizes for PWA.
This script will create all necessary icon sizes and then delete itself.
"""

import os
import sys
from PIL import Image

# Define the icon sizes needed for PWA
ICON_SIZES = [
    (48, 48),      # Favicon
    (72, 72),      # Android
    (96, 96),      # Android
    (128, 128),    # Android
    (144, 144),    # Android
    (152, 152),    # iOS
    (180, 180),    # Apple touch icon
    (192, 192),    # Android (already exists, will be overwritten)
    (384, 384),    # Android
    (512, 512),    # Android (already exists, will be overwritten)
    (1024, 1024),  # iOS
]

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Script is in frontend/scripts/, so frontend is the parent
FRONTEND_DIR = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(FRONTEND_DIR, 'public', 'icons')
SOURCE_ICON = os.path.join(ICONS_DIR, 'icon-512x512.png')
SCRIPT_PATH = os.path.abspath(__file__)


def resize_icons():
    """Resize the source icon to all required sizes."""
    # Check if source icon exists
    if not os.path.exists(SOURCE_ICON):
        print(f"Error: Source icon not found at {SOURCE_ICON}")
        sys.exit(1)
    
    # Ensure icons directory exists
    os.makedirs(ICONS_DIR, exist_ok=True)
    
    # Open the source image
    try:
        source_img = Image.open(SOURCE_ICON)
        print(f"Source icon loaded: {source_img.size[0]}x{source_img.size[1]}")
    except Exception as e:
        print(f"Error opening source icon: {e}")
        sys.exit(1)
    
    # Resize to each size
    created_files = []
    for width, height in ICON_SIZES:
        output_path = os.path.join(ICONS_DIR, f'icon-{width}x{height}.png')
        try:
            # Use high-quality resampling
            resized_img = source_img.resize((width, height), Image.Resampling.LANCZOS)
            resized_img.save(output_path, 'PNG', optimize=True)
            created_files.append(output_path)
            print(f"[OK] Created: icon-{width}x{height}.png")
        except Exception as e:
            print(f"[ERROR] Error creating icon-{width}x{height}.png: {e}")
    
    print(f"\n[SUCCESS] Successfully created {len(created_files)} icon files")
    return created_files


def delete_script():
    """Delete this script after execution."""
    try:
        if os.path.exists(SCRIPT_PATH):
            os.remove(SCRIPT_PATH)
            print(f"\n[OK] Script deleted: {os.path.basename(SCRIPT_PATH)}")
    except Exception as e:
        print(f"\n[WARNING] Could not delete script: {e}")
        print(f"   Please manually delete: {SCRIPT_PATH}")


if __name__ == '__main__':
    print("=" * 60)
    print("TopicsFlow Icon Resizer")
    print("=" * 60)
    print(f"Source: {SOURCE_ICON}")
    print(f"Output: {ICONS_DIR}")
    print(f"Generating {len(ICON_SIZES)} icon sizes...\n")
    
    created_files = resize_icons()
    
    if created_files:
        print("\n" + "=" * 60)
        print("Icon generation complete!")
        print("=" * 60)
        
        # Delete the script
        delete_script()
    else:
        print("\n[ERROR] No icons were created. Exiting without deleting script.")
        sys.exit(1)

