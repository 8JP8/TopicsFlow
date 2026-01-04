"""Utility functions for uploading images to imgbb API."""
import requests
import logging
import base64
import os

logger = logging.getLogger(__name__)

IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'
DEFAULT_MAX_BASE64_SIZE = 2 * 1024 * 1024  # 2MB threshold for using imgbb


def upload_to_imgbb(base64_image: str) -> dict:
    """
    Upload a base64 image to imgbb API.
    
    Args:
        base64_image: Base64 encoded image string (with or without data URL prefix)
    
    Returns:
        dict with 'success' (bool) and either 'url' (str) or 'error' (str)
    """
    try:
        api_key = os.getenv('IMGBB_API_KEY')
        if not api_key:
            return {'success': False, 'error': 'IMGBB_API_KEY not configured'}

        expiration = os.getenv('IMGBB_EXPIRATION_SECONDS')
        params = {'key': api_key}
        if expiration:
            try:
                params['expiration'] = int(expiration)
            except ValueError:
                logger.warning("Invalid IMGBB_EXPIRATION_SECONDS; ignoring")

        # Remove data URL prefix if present (e.g., "data:image/png;base64,")
        if ',' in base64_image:
            base64_image = base64_image.split(',', 1)[1]
        
        # Upload to imgbb
        # imgbb expects multipart/form-data with a form field named "image".
        # With requests, using `data={'image': ...}` sends it as a normal form field (works for base64 strings).
        response = requests.post(
            IMGBB_UPLOAD_URL,
            params=params,
            data={'image': base64_image},
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        
        if result.get('success'):
            image_url = result.get('data', {}).get('url')
            if image_url:
                logger.info(f"Successfully uploaded image to imgbb: {image_url[:50]}...")
                return {
                    'success': True,
                    'url': image_url
                }
            else:
                logger.error("imgbb upload succeeded but no URL in response")
                return {
                    'success': False,
                    'error': 'No URL returned from imgbb'
                }
        else:
            error_msg = result.get('error', {}).get('message', 'Unknown error from imgbb')
            logger.error(f"imgbb upload failed: {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
    
    except requests.exceptions.RequestException as e:
        logger.error(f"imgbb upload request error: {str(e)}")
        return {
            'success': False,
            'error': f'Failed to upload to imgbb: {str(e)}'
        }
    except Exception as e:
        logger.error(f"imgbb upload error: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': f'Unexpected error during imgbb upload: {str(e)}'
        }


def should_use_imgbb(base64_image: str) -> bool:
    """
    Determine if an image should be uploaded to imgbb based on size.
    
    Args:
        base64_image: Base64 encoded image string
    
    Returns:
        bool: True if image should use imgbb, False otherwise
    """
    try:
        use_imgbb = os.getenv('USE_IMGBB', 'false').lower() in ('true', '1', 'yes')
        if not use_imgbb:
            return False

        max_size = DEFAULT_MAX_BASE64_SIZE
        env_max = os.getenv('IMGBB_MAX_BASE64_SIZE_BYTES')
        if env_max:
            try:
                max_size = int(env_max)
            except ValueError:
                logger.warning("Invalid IMGBB_MAX_BASE64_SIZE_BYTES; using default")

        # Remove data URL prefix if present
        if ',' in base64_image:
            base64_image = base64_image.split(',', 1)[1]
        
        # Calculate approximate size (base64 is ~33% larger than binary)
        # We'll use the base64 string length as a proxy
        size_bytes = len(base64_image) * 3 // 4  # Approximate binary size
        
        return size_bytes > max_size
    except Exception as e:
        logger.error(f"Error checking image size: {str(e)}")
        # If we can't determine size, err on the side of using imgbb for safety
        return os.getenv('USE_IMGBB', 'false').lower() in ('true', '1', 'yes')


def _extract_mime_type(base64_image: str) -> str:
    """Extract mime type from base64 string."""
    import re
    if base64_image.startswith('data:'):
        match = re.match(r'^data:(?P<mime>[-\w.]+/[-\w.]+);base64,', base64_image)
        if match:
            return match.group('mime')
    return 'image/jpeg'  # Default

def process_image_for_storage(base64_image: str) -> dict:
    """
    Process an image for storage - upload to imgbb if available, otherwise Azure.
    
    Args:
        base64_image: Base64 encoded image string
    
    Returns:
        dict with 'success' (bool), 'url' (str - either http URL or azure:ID or base64)
    """
    if not base64_image:
        return {
            'success': False,
            'error': 'No image data provided'
        }
    
    # 1. Try ImgBB if key is configured
    api_key = os.getenv('IMGBB_API_KEY')
    if api_key:
        logger.info("IMGBB_API_KEY found, attempting ImgBB upload...")
        imgbb_result = upload_to_imgbb(base64_image)
        if imgbb_result['success']:
             return {
                 'success': True,
                 'url': imgbb_result['url'],
                 'source': 'imgbb'
             }
        else:
             logger.warning(f"ImgBB upload failed: {imgbb_result.get('error')}")
             # Proceed to Azure fallback? User said "if the env variable is set... use imgbb".
             # If it fails, fallback is reasonable.
    
    # 2. Use Azure Storage
    try:
        from services.file_storage import FileStorageService
        # Check if we assume Azure is configured. The user said "if not [imgbb] use azure".
        # We'll use FileStorageService with use_azure=True if configured in env, 
        # but the prompt implies enforcing Azure if ImgBB is missing.
        # We'll rely on FileStorageService defaults/env.
        
        # We need to distinguish if we want to FORCE Azure or just use configured storage.
        # User specified "azure storage container path".
        # We'll check if AZURE is configured.
        if os.getenv('AZURE_STORAGE_CONNECTION_STRING'):
             storage = FileStorageService(use_azure=True)
             
             # Parse base64
             mime_type = _extract_mime_type(base64_image)
             if ',' in base64_image:
                 data_str = base64_image.split(',', 1)[1]
             else:
                 data_str = base64_image
             
             import base64 as b64
             file_data = b64.b64decode(data_str)
             
             # Generate a generic filename
             ext = mime_type.split('/')[-1] if '/' in mime_type else 'jpg'
             filename = f"image.{ext}"
             
             file_id, _ = storage.store_file(file_data, filename, mime_type=mime_type, file_id_prefix='img_')
             
             # Return formatted azure path
             azure_path = f"azure:{file_id}" 
             return {
                 'success': True,
                 'url': azure_path,
                 'source': 'azure'
             }
    except Exception as e:
        logger.error(f"Azure upload failed: {e}")

    # 3. Fallback to base64 if everything fails or no storage configured
    return {
        'success': True,
        'url': base64_image, # "data" was used before, but "url" unifies the return field
        'source': 'base64'
    }

def resolve_image_content(image_str: str) -> str:
    """
    Resolve an image string (URL, base64, or azure:ID) to content useable by frontend.
    If it's an Azure ID, fetches content and returns base64.
    """
    if not image_str:
        return image_str
        
    if image_str.startswith('azure:'):
        try:
            file_id = image_str.split(':', 1)[1]
            from services.file_storage import FileStorageService
            # Assume env vars are set for Azure
            if os.getenv('AZURE_STORAGE_CONNECTION_STRING'):
                storage = FileStorageService(use_azure=True)
                content = storage.get_file_content(file_id)
                if content:
                    import base64 as b64
                    # We don't know the original mime type easily unless we stored it in DB or 
                    # we can guess from bytes/signature.
                    # Or we just return base64 without prefix? Frontend might need prefix.
                    # Let's try to detect mime or default to png/jpg.
                    # Or simpler: The backend just sends base64 string.
                    b64_str = b64.b64encode(content).decode('utf-8')
                    # HACK: Guess mime or use generic.
                    return f"data:image/jpeg;base64,{b64_str}" 
        except Exception as e:
            logger.error(f"Failed to resolve azure image {image_str}: {e}")
            return image_str # Fail safe
            
    return image_str

