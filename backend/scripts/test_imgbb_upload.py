import argparse
import base64
import os
from pathlib import Path

import requests


def main():
    parser = argparse.ArgumentParser(description="Test ImgBB upload using API key and a local image file.")
    parser.add_argument("--api-key", required=False, help="ImgBB API key (or set IMGBB_API_KEY env var)")
    parser.add_argument("--file", required=True, help="Path to image file to upload")
    parser.add_argument("--expiration", default=None, help="Optional expiration seconds (omit by default)")
    args = parser.parse_args()

    api_key = args.api_key or os.getenv("IMGBB_API_KEY")
    if not api_key:
        raise SystemExit("Missing api key. Provide --api-key or set IMGBB_API_KEY.")

    file_path = Path(args.file)
    if not file_path.exists():
        raise SystemExit(f"File not found: {file_path}")

    params = {"key": api_key}
    # Do NOT send expiration unless explicitly provided
    if args.expiration:
        params["expiration"] = str(int(args.expiration))

    # ImgBB accepts either a URL/base64 string in a form field, or a binary file in multipart.
    # Using binary file here is the most reliable for testing.
    with open(file_path, "rb") as f:
        resp = requests.post(
            "https://api.imgbb.com/1/upload",
            params=params,
            files={"image": f},
            timeout=30,
        )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise SystemExit(f"Upload failed: {data}")

    url = data.get("data", {}).get("url")
    print(f"Uploaded OK: {url}")


if __name__ == "__main__":
    main()


