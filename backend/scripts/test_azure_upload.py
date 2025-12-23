import argparse
import getpass
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Test Azure Blob upload to container 'uploads'.")
    parser.add_argument("--file", required=True, help="Path to file to upload")
    parser.add_argument("--container", default="uploads", help="Azure container name (default: uploads)")
    parser.add_argument("--blob-name", default=None, help="Blob name override (default: filename)")
    parser.add_argument("--connection-string", default=None, help="Azure Storage connection string (optional; will prompt if missing)")
    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists() or not file_path.is_file():
        raise SystemExit(f"File not found: {file_path}")

    conn_str = args.connection_string or os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        # getpass hides input on most terminals
        conn_str = getpass.getpass("Azure Storage connection string: ").strip()
    if not conn_str:
        raise SystemExit("Missing connection string")

    try:
        from azure.storage.blob import BlobServiceClient, ContentSettings
    except Exception as e:
        raise SystemExit("Missing dependency. Install with: pip install azure-storage-blob") from e

    blob_service = BlobServiceClient.from_connection_string(conn_str)
    container_client = blob_service.get_container_client(args.container)

    if not container_client.exists():
        container_client.create_container()

    blob_name = args.blob_name or file_path.name
    blob_client = container_client.get_blob_client(blob_name)

    # Basic content-type guess
    content_type = "application/octet-stream"
    suffix = file_path.suffix.lower()
    if suffix in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        content_type = f"image/{'jpeg' if suffix in ('.jpg', '.jpeg') else suffix.lstrip('.')}"
    elif suffix == ".pdf":
        content_type = "application/pdf"

    with open(file_path, "rb") as f:
        blob_client.upload_blob(
            f,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )

    # Construct URL (no SAS)
    account_url = blob_service.url.rstrip("/")
    url = f"{account_url}/{args.container}/{blob_name}"
    print(f"Uploaded OK: {url}")


if __name__ == "__main__":
    main()


