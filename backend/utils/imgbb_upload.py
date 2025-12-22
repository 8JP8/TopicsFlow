"""Utility functions for uploading images to imgbb API."""
import requests
import logging
import base64

logger = logging.getLogger(__name__)

IMGBB_API_KEY = os.getenv('IMGBB_API_KEY')
IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'
MAX_BASE64_SIZE = 2 * 1024 * 1024  # 2MB threshold for using imgbb


def upload_to_imgbb(base64_image: str) -> dict:
    """
    Upload a base64 image to imgbb API.
    
    Args:
        base64_image: Base64 encoded image string (with or without data URL prefix)
    
    Returns:
        dict with 'success' (bool) and either 'url' (str) or 'error' (str)
    """
    try:
        # Remove data URL prefix if present (e.g., "data:image/png;base64,")
        if ',' in base64_image:
            base64_image = base64_image.split(',', 1)[1]
        
        # Prepare the request
        payload = {
            'key': IMGBB_API_KEY,
            'image': base64_image
        }
        
        # Upload to imgbb
        response = requests.post(IMGBB_UPLOAD_URL, data=payload, timeout=30)
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
        # Remove data URL prefix if present
        if ',' in base64_image:
            base64_image = base64_image.split(',', 1)[1]
        
        # Calculate approximate size (base64 is ~33% larger than binary)
        # We'll use the base64 string length as a proxy
        size_bytes = len(base64_image) * 3 // 4  # Approximate binary size
        
        return size_bytes > MAX_BASE64_SIZE
    except Exception as e:
        logger.error(f"Error checking image size: {str(e)}")
        # If we can't determine size, err on the side of using imgbb for safety
        return True


def process_image_for_storage(base64_image: str) -> dict:
    """
    Process an image for storage - upload to imgbb if large, otherwise return base64.
    
    Args:
        base64_image: Base64 encoded image string
    
    Returns:
        dict with 'success' (bool), 'url' (str if imgbb) or 'data' (str if base64), and 'source' ('imgbb' or 'base64')
    """
    if not base64_image:
        return {
            'success': False,
            'error': 'No image data provided'
        }
    
    # Check if we should use imgbb
    if should_use_imgbb(base64_image):
        logger.info("Image is large, uploading to imgbb...")
        imgbb_result = upload_to_imgbb(base64_image)
        
        if imgbb_result['success']:
            return {
                'success': True,
                'url': imgbb_result['url'],
                'source': 'imgbb'
            }
        else:
            # If imgbb fails, fall back to base64 (might fail in MongoDB but better than nothing)
            logger.warning(f"imgbb upload failed, falling back to base64: {imgbb_result.get('error')}")
            return {
                'success': True,
                'data': base64_image,
                'source': 'base64'
            }
    else:
        # Small image, use base64
        return {
            'success': True,
            'data': base64_image,
            'source': 'base64'
        }

