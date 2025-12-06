"""
Helper functions for processing file uploads and attachments.
"""
import os
import base64
import logging
from typing import List, Dict, Any, Optional, Tuple
from services.file_storage import FileStorageService

logger = logging.getLogger(__name__)


def process_attachments(attachments: List[Dict[str, Any]], 
                       file_storage: FileStorageService,
                       user_id: str = None,
                       secret_key: str = None) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Process attachments: convert base64 to files, store them, and return file references.
    
    Args:
        attachments: List of attachment objects with base64 data
        file_storage: FileStorageService instance
        user_id: User ID uploading the files
    
    Returns:
        Tuple of (processed_attachments, error_messages)
    """
    processed = []
    errors = []
    
    logger.info(f"Processing {len(attachments)} attachments")
    
    for attachment in attachments:
        try:
            attachment_type = attachment.get('type', 'file')
            filename = attachment.get('filename', 'file')
            mime_type = attachment.get('mime_type', 'application/octet-stream')
            
            # Check if it's already a file reference (has file_id)
            if 'file_id' in attachment and 'url' in attachment:
                # Already processed, just add it
                processed.append(attachment)
                continue
            
            # Check if it's base64 data
            if 'data' in attachment:
                # Decode base64
                try:
                    # Remove data URL prefix if present
                    data_str = attachment['data']
                    if ',' in data_str:
                        data_str = data_str.split(',', 1)[1]
                    
                    file_data = base64.b64decode(data_str)
                except Exception as e:
                    errors.append(f"Failed to decode base64 for {filename}: {str(e)}")
                    continue
                
                # Store file
                file_id, file_path = file_storage.store_file(
                    file_data=file_data,
                    filename=filename,
                    mime_type=mime_type,
                    user_id=user_id
                )
                
                # Generate encryption key for file access if secret_key provided
                encryption_key = None
                if secret_key:
                    encryption_key = _generate_encryption_key(file_id, secret_key)
                
                # Get file URL
                file_url = file_storage.get_file_url(file_id, encryption_key)
                
                # Create processed attachment (NO base64 data - only file reference)
                processed_attachment = {
                    'type': attachment_type,
                    'file_id': file_id,
                    'url': file_url,
                    'filename': filename,
                    'size': len(file_data),
                    'mime_type': mime_type
                }
                # Explicitly ensure no base64 data
                if 'data' in processed_attachment:
                    logger.error(f"CRITICAL: processed_attachment still has 'data' field! Removing it.")
                    del processed_attachment['data']
                
                logger.info(f"Processed attachment: file_id={file_id}, url={file_url[:50]}..., size={len(file_data)}")
                processed.append(processed_attachment)
            else:
                # No data, might be URL reference - but remove any base64 data if present
                clean_attachment = {k: v for k, v in attachment.items() if k != 'data'}
                processed.append(clean_attachment)
        
        except Exception as e:
            logger.error(f"Error processing attachment: {e}")
            errors.append(f"Failed to process {attachment.get('filename', 'attachment')}: {str(e)}")
    
    return processed, errors


def _generate_encryption_key(file_id: str, secret_key: str) -> str:
    """Generate encryption key for a file."""
    import hashlib
    key_data = f"{file_id}:{secret_key}".encode('utf-8')
    return hashlib.sha256(key_data).hexdigest()[:16]


def process_profile_picture(base64_data: str) -> Optional[str]:
    """
    Process profile picture - keep as base64 (binary in database).
    Returns normalized base64 string.
    """
    if not base64_data:
        return None
    
    # Remove data URL prefix if present
    if ',' in base64_data:
        base64_data = base64_data.split(',', 1)[1]
    
    # Validate base64
    try:
        base64.b64decode(base64_data)
        return base64_data
    except Exception as e:
        logger.error(f"Invalid base64 data for profile picture: {e}")
        return None

