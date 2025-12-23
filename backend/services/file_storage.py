"""
File Storage Service
Handles file uploads, deduplication, and storage (local filesystem or Azure Blob Storage)
Profile photos are stored as binary (base64) in database.
Other files (attachments, images, videos) are stored in filesystem/cloud storage.
"""
import os
import hashlib
import json
from typing import Optional, Dict, Tuple, BinaryIO
from pathlib import Path
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

try:
    from azure.storage.blob import BlobServiceClient, BlobClient, ContentSettings
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False
    logger.warning("Azure Storage SDK not available. Install with: pip install azure-storage-blob")


class FileStorageService:
    """Service for handling file storage with deduplication."""
    
    def __init__(self, uploads_dir: str = None, use_azure: bool = False):
        """
        Initialize file storage service.
        
        Args:
            uploads_dir: Local directory for file uploads (default: backend/uploads)
            use_azure: Whether to use Azure Blob Storage instead of local filesystem
        """
        self.use_azure = use_azure and AZURE_AVAILABLE
        
        if self.use_azure:
            self._init_azure_storage()
        else:
            # Local filesystem storage
            if uploads_dir is None:
                # Default to backend/uploads directory
                base_dir = Path(__file__).parent.parent
                uploads_dir = str(base_dir / 'uploads')
            
            self.uploads_dir = Path(uploads_dir)
            self.uploads_dir.mkdir(parents=True, exist_ok=True)
            
            # Create subdirectories
            (self.uploads_dir / 'images').mkdir(exist_ok=True)
            (self.uploads_dir / 'videos').mkdir(exist_ok=True)
            (self.uploads_dir / 'files').mkdir(exist_ok=True)
            
            # Index file for deduplication metadata
            self.index_file = self.uploads_dir / 'file_index.json'
            self._load_index()
    
    def _init_azure_storage(self):
        """Initialize Azure Blob Storage client."""
        if not AZURE_AVAILABLE:
            raise ImportError("Azure Storage SDK not available")
        
        connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        container_name = os.getenv('AZURE_STORAGE_CONTAINER', os.getenv('AZURE_STORAGE_CONTAINER_NAME', 'uploads'))
        
        if not connection_string:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING environment variable not set")
        
        self.blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        self.container_name = container_name
        
        # Create container if it doesn't exist
        try:
            container_client = self.blob_service_client.get_container_client(container_name)
            if not container_client.exists():
                container_client.create_container()
        except Exception as e:
            logger.error(f"Failed to create Azure container: {e}")
            raise
    
    def _load_index(self):
        """Load file index for deduplication."""
        if self.use_azure:
            # For Azure, we'll use blob metadata instead
            self.file_index = {}
            return
        
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r') as f:
                    self.file_index = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load file index: {e}")
                self.file_index = {}
        else:
            self.file_index = {}
    
    def _save_index(self):
        """Save file index to disk."""
        if self.use_azure:
            return  # Azure uses blob metadata
        
        try:
            with open(self.index_file, 'w') as f:
                json.dump(self.file_index, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save file index: {e}")
    
    def _calculate_file_hash(self, file_data: bytes) -> str:
        """Calculate SHA256 hash of file data."""
        return hashlib.sha256(file_data).hexdigest()
    
    def _get_file_metadata(self, filename: str, file_data: bytes, mime_type: str = None) -> Dict:
        """Get file metadata for deduplication."""
        return {
            'filename': filename,
            'size': len(file_data),
            'hash': self._calculate_file_hash(file_data),
            'mime_type': mime_type,
            'created_at': datetime.utcnow().isoformat()
        }
    
    def _check_duplicate(self, metadata: Dict) -> Optional[str]:
        """
        Check if file already exists based on filename, size, and hash.
        Returns existing file_id if duplicate found, None otherwise.
        """
        if self.use_azure:
            # Check Azure blob storage
            return self._check_azure_duplicate(metadata)
        
        # Check local index
        for file_id, file_info in self.file_index.items():
            if (file_info.get('filename') == metadata['filename'] and
                file_info.get('size') == metadata['size'] and
                file_info.get('hash') == metadata['hash']):
                # Duplicate found, return existing file_id
                return file_id
        
        return None
    
    def _check_azure_duplicate(self, metadata: Dict) -> Optional[str]:
        """Check for duplicate in Azure Blob Storage."""
        try:
            container_client = self.blob_service_client.get_container_client(self.container_name)
            
            # List blobs and check metadata
            for blob in container_client.list_blobs():
                blob_client = container_client.get_blob_client(blob.name)
                blob_props = blob_client.get_blob_properties()
                
                # Check metadata stored in blob properties
                blob_metadata = blob_props.metadata
                if (blob_metadata.get('filename') == metadata['filename'] and
                    int(blob_metadata.get('size', 0)) == metadata['size'] and
                    blob_metadata.get('hash') == metadata['hash']):
                    # Duplicate found - extract file_id from blob name
                    # Blob name format: file_type_dir/file_id.ext
                    file_id = Path(blob.name).stem  # Gets filename without extension
                    return file_id
            
            return None
        except Exception as e:
            logger.error(f"Error checking Azure duplicate: {e}")
            return None
    
    def _generate_file_id(self, filename: str, file_data: bytes, prefix: str = None) -> str:
        """Generate unique file ID based on hash and timestamp."""
        file_hash = self._calculate_file_hash(file_data)
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        # Use first 8 chars of hash + timestamp for unique ID
        base_id = f"{file_hash[:8]}_{timestamp}"
        if prefix:
             return f"{prefix}{base_id}"
        return base_id
    
    def _get_file_type_dir(self, mime_type: str) -> str:
        """Get subdirectory based on file type."""
        if mime_type:
            if mime_type.startswith('image/'):
                return 'images'
            elif mime_type.startswith('video/'):
                return 'videos'
        return 'files'
    
    def store_file(self, file_data: bytes, filename: str, mime_type: str = None, 
                   user_id: str = None, file_id_prefix: str = None) -> Tuple[str, str]:
        """
        Store file with deduplication.
        
        Args:
            file_data: File content as bytes
            filename: Original filename
            mime_type: MIME type of the file
            user_id: ID of user uploading the file (optional)
            file_id_prefix: Optional prefix for the generated file ID
        
        Returns:
            Tuple of (file_id, file_path_or_url)
        """
        metadata = self._get_file_metadata(filename, file_data, mime_type)
        
        # Check for duplicate - only if no prefix is forced (duplicates with prefix are rare/handled by ID gen)
        # Actually, if we want to support prefixes, we should probably skip dedup or verify if existing ID has same prefix
        # For simplicity, if prefix is present, we skip deduplication check or assume it's unique enough for now
        if not file_id_prefix:
             existing_file_id = self._check_duplicate(metadata)
             if existing_file_id:
                 logger.info(f"Duplicate file found: {filename}, reusing existing file")
                 # Return existing file_id
                 return existing_file_id, existing_file_id
        
        # New file, generate ID and store
        file_id = self._generate_file_id(filename, file_data, prefix=file_id_prefix)
        
        if self.use_azure:
            stored_id = self._store_azure_file(file_id, file_data, filename, mime_type, metadata)
        else:
            stored_id = self._store_local_file(file_id, file_data, filename, mime_type, metadata)
        
        # Update index
        if not self.use_azure:
            # Store the actual file path in index for retrieval
            file_type_dir = self._get_file_type_dir(mime_type)
            file_ext = Path(filename).suffix
            actual_path = f"{file_type_dir}/{file_id}{file_ext}"
            
            self.file_index[file_id] = {
                'path': actual_path,  # Store relative path for retrieval
                **metadata,
                'user_id': user_id
            }
            self._save_index()
        
        return file_id, file_id  # Return file_id for both path and ID
    
    def _store_local_file(self, file_id: str, file_data: bytes, filename: str, 
                         mime_type: str, metadata: Dict) -> str:
        """Store file in local filesystem."""
        file_type_dir = self._get_file_type_dir(mime_type)
        file_dir = self.uploads_dir / file_type_dir
        file_dir.mkdir(exist_ok=True)
        
        # Preserve original extension
        file_ext = Path(filename).suffix
        stored_filename = f"{file_id}{file_ext}"
        file_path = file_dir / stored_filename
        
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        # Return just the file_id (not the path) - path is stored in index
        return file_id
    
    def _store_azure_file(self, file_id: str, file_data: bytes, filename: str,
                         mime_type: str, metadata: Dict) -> str:
        """Store file in Azure Blob Storage."""
        # Flatten structure: blob name is just file_id + ext
        # This simplifies retrieval later as we don't need to guess folders
        file_ext = Path(filename).suffix
        blob_name = f"{file_id}{file_ext}"
        
        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name,
            blob=blob_name
        )
        
        # Upload with metadata
        blob_metadata = {
            'filename': metadata['filename'],
            'size': str(metadata['size']),
            'hash': metadata['hash'],
            'mime_type': mime_type or '',
            'created_at': metadata['created_at']
        }
        
        blob_client.upload_blob(
            file_data,
            overwrite=True, # Allow overwrite if hash matches (idempotent)
            metadata=blob_metadata,
            content_settings=ContentSettings(content_type=mime_type or 'application/octet-stream')
        )
        
        # Return just the file_id
        return file_id
    
    def get_file_url(self, file_id: str, encryption_key: str = None) -> str:
        """
        Get URL to access file.
        
        Args:
            file_id: File identifier (just the ID, not the full path)
            encryption_key: Optional encryption key for secure access
        
        Returns:
            URL to access the file
        """
        # Local file URL (works for both local and Azure)
        base_url = os.getenv('API_BASE_URL', 'http://localhost:5000')
        url = f"{base_url}/api/attachments/{file_id}"
        if encryption_key:
            url += f"?p={encryption_key}"
        return url
    
    def get_file_path(self, file_id: str) -> Optional[str]:
        """Get local file path (for local storage only)."""
        if self.use_azure:
            return None
        
        if file_id in self.file_index:
            file_info = self.file_index[file_id]
            stored_path = file_info.get('path')
            if stored_path:
                # If path is relative, construct full path
                if not os.path.isabs(stored_path):
                    return str(self.uploads_dir / stored_path)
                return stored_path
            else:
                # Reconstruct path from file_id and metadata
                mime_type = file_info.get('mime_type', '')
                filename = file_info.get('filename', 'file')
                file_type_dir = self._get_file_type_dir(mime_type)
                file_ext = Path(filename).suffix
                return str(self.uploads_dir / file_type_dir / f"{file_id}{file_ext}")
        
        return None
    
    def delete_file(self, file_id: str) -> bool:
        """Delete file from storage."""
        try:
            if self.use_azure:
                container_client = self.blob_service_client.get_container_client(self.container_name)
                # Find blob by file_id prefix (since we don't know the extension)
                blobs = list(container_client.list_blobs(name_starts_with=file_id))
                for blob in blobs:
                    container_client.delete_blob(blob.name)
            else:
                if file_id in self.file_index:
                    file_path = self.get_file_path(file_id)
                    if file_path and os.path.exists(file_path):
                        os.remove(file_path)
                    del self.file_index[file_id]
                    self._save_index()
            
            return True
        except Exception as e:
            logger.error(f"Failed to delete file {file_id}: {e}")
            return False

    def cleanup_old_files(self, prefix: str, max_age_seconds: int) -> int:
        """
        Cleanup old files starting with prefix.

        Args:
            prefix: File ID prefix to match
            max_age_seconds: Maximum age in seconds

        Returns:
            Number of files deleted
        """
        count = 0
        now = datetime.utcnow()

        try:
            if self.use_azure:
                container_client = self.blob_service_client.get_container_client(self.container_name)
                # List blobs matching prefix
                # Note: This is an approximation as name_starts_with matches blob name, which is file_id.ext
                # Since our file_id starts with prefix, this works.
                blobs = container_client.list_blobs(name_starts_with=prefix)

                for blob in blobs:
                    # Check age
                    creation_time = blob.creation_time.replace(tzinfo=None)
                    age = (now - creation_time).total_seconds()

                    if age > max_age_seconds:
                        # Delete blob
                        # We use delete_blob directly to avoid re-listing
                        try:
                            container_client.delete_blob(blob.name)
                            count += 1
                            logger.info(f"Cleaned up old Azure blob: {blob.name}")
                        except Exception as e:
                            logger.warning(f"Failed to delete old blob {blob.name}: {e}")

            else:
                # Local cleanup
                # Iterate through all type directories
                type_dirs = ['images', 'videos', 'files']

                for type_dir in type_dirs:
                    dir_path = self.uploads_dir / type_dir
                    if not dir_path.exists():
                        continue

                    # Find files starting with prefix
                    for file_path in dir_path.iterdir():
                        if file_path.is_file() and file_path.name.startswith(prefix):
                            # Check age
                            stat = file_path.stat()
                            mtime = datetime.utcfromtimestamp(stat.st_mtime)
                            age = (now - mtime).total_seconds()

                            if age > max_age_seconds:
                                # Get file_id (filename without extension)
                                file_id = file_path.stem

                                # Use delete_file to handle index cleanup
                                if self.delete_file(file_id):
                                    count += 1
                                    logger.info(f"Cleaned up old local file: {file_path.name}")

        except Exception as e:
            logger.error(f"Error during file cleanup: {e}")

        return count
