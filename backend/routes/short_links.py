from flask import Blueprint, request, jsonify, current_app, redirect
import logging
from datetime import datetime
import string
import random
from bson import ObjectId

logger = logging.getLogger(__name__)
short_links_bp = Blueprint('short_links', __name__)

def generate_short_code(length=6):
    """Generate a random short code."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

@short_links_bp.route('/api/short-links/generate', methods=['POST'])
def generate_short_link():
    """Generate a short link for a given URL."""
    try:
        data = request.get_json()
        target_url = data.get('url')
        
        if not target_url:
            return jsonify({'success': False, 'errors': ['URL is required']}), 400

        db = current_app.db
        
        # Check if URL already exists to reuse code (optional, but good for space)
        existing = db.short_links.find_one({'target_url': target_url})
        if existing:
            short_code = existing['code']
        else:
            # Generate unique code
            max_retries = 5
            for _ in range(max_retries):
                short_code = generate_short_code()
                if not db.short_links.find_one({'code': short_code}):
                    break
            else:
                return jsonify({'success': False, 'errors': ['Failed to generate unique code']}), 500

            db.short_links.insert_one({
                'code': short_code,
                'target_url': target_url,
                'created_at': datetime.utcnow(),
                'clicks': 0
            })

        # Construct full short URL
        # Access host from request context
        base_url = request.host_url.rstrip('/')
        short_url = f"{base_url}/s/{short_code}"

        return jsonify({
            'success': True,
            'data': {
                'short_code': short_code,
                'short_url': short_url
            }
        }), 200

    except Exception as e:
        logger.error(f"Error generating short link: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'errors': ['Internal server error']}), 500

@short_links_bp.route('/s/<code>', methods=['GET'])
def redirect_short_link(code):
    """Redirect a short link to its target."""
    try:
        db = current_app.db
        link = db.short_links.find_one({'code': code})
        
        if not link:
            return "Link not found", 404
            
        # Update click count async or verified
        db.short_links.update_one(
            {'_id': link['_id']},
            {'$inc': {'clicks': 1}, '$set': {'last_accessed': datetime.utcnow()}}
        )
        
        return redirect(link['target_url'])
        
    except Exception as e:
        logger.error(f"Error redirecting short link: {str(e)}", exc_info=True)
        return "Internal server error", 500
