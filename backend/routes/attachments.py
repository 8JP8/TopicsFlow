"""
Attachments route for serving files with encryption key protection.
"""
from flask import Blueprint, request, send_file, jsonify, current_app, abort
from services.auth_service import AuthService
from services.file_storage import FileStorageService
from utils.decorators import log_requests
import os
import logging
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)
attachments_bp = Blueprint('attachments', __name__)


def _validate_encryption_key(file_id: str, provided_key: str, expected_key: str) -> bool:
    """
    Validate encryption key for file access.
    Uses a combination of file_id and expected_key to generate a unique key.
    """
    if not provided_key:
        return False
    
    # Generate expected key hash from file_id + expected_key
    key_data = f"{file_id}:{expected_key}".encode('utf-8')
    expected_hash = hashlib.sha256(key_data).hexdigest()[:16]  # First 16 chars
    
    return provided_key == expected_hash


def _generate_encryption_key(file_id: str, secret_key: str) -> str:
    """Generate encryption key for a file."""
    key_data = f"{file_id}:{secret_key}".encode('utf-8')
    return hashlib.sha256(key_data).hexdigest()[:16]


@attachments_bp.route('/<file_id>', methods=['GET'])
@log_requests
def get_attachment(file_id):
    """
    Serve attachment file with encryption key protection.
    URL format: /api/attachments/<file_id>?p=<encryption_key>
    """
    try:
        # Get encryption key from query parameter
        encryption_key = request.args.get('p')
        
        if not encryption_key:
            abort(403, description="Encryption key required")
        
        # Get file storage service
        use_azure = current_app.config.get('USE_AZURE_STORAGE', False)
        file_storage = FileStorageService(
            uploads_dir=current_app.config.get('UPLOADS_DIR'),
            use_azure=use_azure
        )
        
        # Validate encryption key
        secret_key = current_app.config.get('FILE_ENCRYPTION_KEY') or current_app.config.get('SECRET_KEY')
        expected_key = _generate_encryption_key(file_id, secret_key)
        
        if not _validate_encryption_key(file_id, encryption_key, secret_key):
            abort(403, description="Invalid encryption key")
        
        # Get file path or URL
        if use_azure:
            # For Azure, we need to find the blob by file_id
            try:
                from azure.storage.blob import BlobServiceClient
                connection_string = current_app.config.get('AZURE_STORAGE_CONNECTION_STRING')
                container_name = current_app.config.get('AZURE_STORAGE_CONTAINER', 'attachments')
                
                blob_service = BlobServiceClient.from_connection_string(connection_string)
                container_client = blob_service.get_container_client(container_name)
                
                # Search for blob with matching file_id in name or metadata
                blob_name = None
                for blob in container_client.list_blobs():
                    # Check if file_id matches (blob name format: type_dir/file_id.ext)
                    if file_id in blob.name:
                        blob_name = blob.name
                        break
                
                if not blob_name:
                    abort(404, description="File not found")
                
                blob_client = container_client.get_blob_client(blob_name)
                
                # Download blob to temporary file
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                    blob_data = blob_client.download_blob()
                    tmp_file.write(blob_data.readall())
                    tmp_path = tmp_file.name
                
                # Get content type from blob properties
                blob_props = blob_client.get_blob_properties()
                content_type = blob_props.content_settings.content_type
                
                return send_file(
                    tmp_path,
                    mimetype=content_type,
                    as_attachment=False,
                    download_name=blob_props.metadata.get('filename', file_id)
                )
            except Exception as e:
                logger.error(f"Failed to serve Azure blob: {e}")
                abort(404, description="File not found")
        else:
            # Local file storage
            file_path = file_storage.get_file_path(file_id)
            
            if not file_path or not os.path.exists(file_path):
                abort(404, description="File not found")
            
            # Get file info from index
            file_info = file_storage.file_index.get(file_id, {})
            filename = file_info.get('filename', file_id)
            mime_type = file_info.get('mime_type', 'application/octet-stream')
            
            return send_file(
                file_path,
                mimetype=mime_type,
                as_attachment=False,
                download_name=filename
            )
    
    except Exception as e:
        logger.error(f"Error serving attachment: {e}")
        abort(500, description="Failed to serve file")


@attachments_bp.route('/<file_id>/info', methods=['GET'])
@log_requests
def get_attachment_info(file_id):
    """Get file information (requires authentication)."""
    try:
        auth_service = AuthService(current_app.db)
        current_user_result = auth_service.get_current_user()
        if not current_user_result.get('success'):
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401
        
        use_azure = current_app.config.get('USE_AZURE_STORAGE', False)
        file_storage = FileStorageService(
            uploads_dir=current_app.config.get('UPLOADS_DIR'),
            use_azure=use_azure
        )
        
        if use_azure:
            # Get info from Azure blob
            try:
                from azure.storage.blob import BlobClient
                connection_string = current_app.config.get('AZURE_STORAGE_CONNECTION_STRING')
                container_name = current_app.config.get('AZURE_STORAGE_CONTAINER', 'attachments')
                
                blob_client = BlobClient.from_connection_string(
                    connection_string,
                    container_name=container_name,
                    blob_name=file_id
                )
                
                blob_props = blob_client.get_blob_properties()
                metadata = blob_props.metadata
                
                return jsonify({
                    'success': True,
                    'data': {
                        'file_id': file_id,
                        'filename': metadata.get('filename', file_id),
                        'size': int(metadata.get('size', 0)),
                        'mime_type': blob_props.content_settings.content_type,
                        'created_at': metadata.get('created_at')
                    }
                }), 200
            except Exception as e:
                logger.error(f"Failed to get Azure blob info: {e}")
                return jsonify({'success': False, 'errors': ['File not found']}), 404
        else:
            # Get info from local index
            if file_id not in file_storage.file_index:
                return jsonify({'success': False, 'errors': ['File not found']}), 404
            
            file_info = file_storage.file_index[file_id]
            
            return jsonify({
                'success': True,
                'data': {
                    'file_id': file_id,
                    'filename': file_info.get('filename'),
                    'size': file_info.get('size'),
                    'mime_type': file_info.get('mime_type'),
                    'created_at': file_info.get('created_at')
                }
            }), 200
    
    except Exception as e:
        logger.error(f"Error getting attachment info: {e}")
        return jsonify({'success': False, 'errors': ['Failed to get file info']}), 500

