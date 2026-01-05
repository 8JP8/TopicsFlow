"""
Image compression utility for profile pictures and other images.
Compresses images to reduce storage size while maintaining good quality.
"""
import base64
import io
from typing import Optional, Tuple
from PIL import Image
import logging

logger = logging.getLogger(__name__)

# Maximum dimensions for profile pictures
MAX_PROFILE_PICTURE_WIDTH = 800
MAX_PROFILE_PICTURE_HEIGHT = 800
MAX_PROFILE_PICTURE_SIZE_KB = 500  # Target max size in KB for avatars

# New limits for overall image uploads
MAX_IMAGE_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB
COMPRESSION_THRESHOLD = 25 * 1024 * 1024   # 25MB

# Quality settings
JPEG_QUALITY = 85  # Good balance between quality and size
PNG_QUALITY = 90


def compress_image_base64(
    base64_string: str,
    max_width: int = MAX_PROFILE_PICTURE_WIDTH,
    max_height: int = MAX_PROFILE_PICTURE_HEIGHT,
    max_size_kb: Optional[int] = None, # Changed to Optional
    quality: int = JPEG_QUALITY,
    force_compression: bool = False
) -> Optional[str]:
    """
    Compress a base64-encoded image.
    
    Args:
        base64_string: Base64-encoded image string (with or without data URI prefix)
        max_width: Maximum width in pixels
        max_height: Maximum height in pixels
        max_size_kb: Target maximum size in KB. If None, uses COMPRESSION_THRESHOLD logic.
        quality: JPEG quality (1-100, higher = better quality but larger file)
        force_compression: If True, always compress regardless of size
    
    Returns:
        Compressed base64-encoded image string, or None if compression fails
    """
    try:
        # Remove data URI prefix if present (e.g., "data:image/jpeg;base64,")
        prefix = ""
        if ',' in base64_string:
            prefix, base64_string = base64_string.split(',', 1)
            prefix += ","
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_string)
        original_size = len(image_bytes)
        original_size_kb = original_size / 1024
        
        # Check against absolute limit
        if original_size > MAX_IMAGE_UPLOAD_SIZE:
            logger.error(f"Image too large: {original_size_kb:.2f} KB exceeds {MAX_IMAGE_UPLOAD_SIZE/1024/1024:.2f} MB")
            return None

        # Determine if compression is needed
        needs_compression = force_compression or original_size > COMPRESSION_THRESHOLD or max_size_kb is not None
        
        if not needs_compression:
            logger.info(f"Image size {original_size_kb:.2f} KB is under threshold. Skipping compression.")
            return prefix + base64_string
        
        logger.info(f"Compressing image. Original size: {original_size_kb:.2f} KB")
        
        # Open image with PIL
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert RGBA to RGB if necessary (for JPEG compatibility)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            rgb_image = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            rgb_image.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = rgb_image
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if necessary (only if max_width/height are specifically small, like for avatars)
        # For general large images, we might want to keep the resolution unless it's insane.
        # If max_size_kb is set (e.g. 500KB for avatars), we resize.
        # Otherwise, if it's just > 25MB, we might just compress the quality first.
        if max_size_kb and (image.width > max_width or image.height > max_height):
            image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized to: {image.width}x{image.height}")
        
        # Target size in KB
        target_size_kb = max_size_kb if max_size_kb else 10240 # Default to 10MB if just over threshold
        
        # Compress with quality adjustment
        output = io.BytesIO()
        current_quality = quality
        
        # Try to get under target_size_kb by reducing quality if needed
        for attempt in range(5):  # Max 5 attempts
            output.seek(0)
            output.truncate(0)
            
            image.save(output, format='JPEG', quality=current_quality, optimize=True)
            compressed_size_kb = len(output.getvalue()) / 1024
            
            logger.info(f"Attempt {attempt + 1}: Quality={current_quality}, Size={compressed_size_kb:.2f} KB")
            
            # If we're under the target size or quality is already low, we're done
            if compressed_size_kb <= target_size_kb or current_quality <= 50:
                break
            
            # Reduce quality for next attempt
            current_quality = max(50, int(current_quality * 0.85))
        
        # Encode back to base64
        compressed_bytes = output.getvalue()
        compressed_base64 = base64.b64encode(compressed_bytes).decode('utf-8')
        final_size_kb = len(compressed_bytes) / 1024
        
        compression_ratio = (1 - (final_size_kb / original_size_kb)) * 100 if original_size_kb > 0 else 0
        logger.info(f"Compressed image: {final_size_kb:.2f} KB ({compression_ratio:.1f}% reduction)")
        
        return prefix + compressed_base64
        
    except Exception as e:
        logger.error(f"Image compression failed: {str(e)}", exc_info=True)
        return None


def get_image_info(base64_string: str) -> Optional[Tuple[int, int, float]]:
    """
    Get image dimensions and size from base64 string.
    
    Returns:
        Tuple of (width, height, size_kb) or None if parsing fails
    """
    try:
        # Remove data URI prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        image_bytes = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_bytes))
        
        size_kb = len(image_bytes) / 1024
        
        return (image.width, image.height, size_kb)
    except Exception as e:
        logger.error(f"Failed to get image info: {str(e)}")
        return None


def darken_image_base64(base64_string: str, darkness_factor: float = 0.6) -> Optional[str]:
    """
    Darken a base64-encoded image by applying a darkening overlay.
    
    Args:
        base64_string: Base64-encoded image string (with or without data URI prefix)
        darkness_factor: How much to darken (0.0 = no darkening, 1.0 = completely black)
                        Default 0.6 means 60% darker
    
    Returns:
        Darkened base64-encoded image string, or None if processing fails
    """
    try:
        # Remove data URI prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_string)
        
        # Open image with PIL
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert RGBA to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            rgb_image = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            rgb_image.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = rgb_image
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Create a dark overlay
        dark_overlay = Image.new('RGB', image.size, (0, 0, 0))
        
        # Blend the image with the dark overlay
        darkened = Image.blend(image, dark_overlay, darkness_factor)
        
        # Encode back to base64
        output = io.BytesIO()
        darkened.save(output, format='JPEG', quality=85, optimize=True)
        darkened_base64 = base64.b64encode(output.getvalue()).decode('utf-8')
        
        logger.info(f"Darkened image with factor {darkness_factor}")
        return darkened_base64
        
    except Exception as e:
        logger.error(f"Image darkening failed: {str(e)}", exc_info=True)
        return None


