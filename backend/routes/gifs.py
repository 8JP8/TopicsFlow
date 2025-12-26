"""
GIF API routes for Tenor integration
"""
from flask import Blueprint, request, jsonify, current_app
from services.tenor_service import TenorService
from utils.decorators import require_auth, log_requests
from utils.cache_decorator import cache_result
import logging

logger = logging.getLogger(__name__)
gifs_bp = Blueprint('gifs', __name__)


@gifs_bp.route('/search', methods=['GET'])
@require_auth()
@cache_result(ttl=3600, key_prefix='gifs:search')
@log_requests
def search_gifs():
    """Search for GIFs using Tenor API v2."""
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 20))
        
        if not query:
            return jsonify({
                'success': False,
                'errors': ['Search query is required']
            }), 400
        
        tenor_service = TenorService()
        result = tenor_service.search_gifs(
            query=query,
            limit=limit
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result['results'],
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': [result.get('error', 'Failed to search GIFs')]
            }), 500
            
    except Exception as e:
        logger.error(f"Search GIFs error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'errors': [f'Failed to search GIFs: {str(e)}']
        }), 500


@gifs_bp.route('/trending', methods=['GET'])
@require_auth()
@cache_result(ttl=3600, key_prefix='gifs:trending')
@log_requests
def get_trending_gifs():
    """Get featured GIFs from Tenor API v2 (trending endpoint for backward compatibility)."""
    try:
        limit = int(request.args.get('limit', 20))
        locale = request.args.get('locale', 'en_US')
        
        tenor_service = TenorService()
        
        # Check if API key is configured
        if not tenor_service.api_key:
            logger.warning("Tenor API key not configured")
            return jsonify({
                'success': True,
                'data': [],
                'message': 'Tenor API key not configured. Please set TENOR_API_KEY in environment variables.'
            }), 200
        
        result = tenor_service.get_featured_gifs(
            limit=limit,
            locale=locale
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result['results']
            }), 200
        else:
            error_msg = result.get('error', 'Failed to get featured GIFs')
            logger.error(f"Tenor API error: {error_msg}")
            return jsonify({
                'success': False,
                'errors': [error_msg],
                'data': []
            }), 200
            
    except Exception as e:
        logger.error(f"Get trending GIFs error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'errors': [f'Failed to get trending GIFs: {str(e)}']
        }), 500


@gifs_bp.route('/popular', methods=['GET'])
@require_auth()
@cache_result(ttl=3600, key_prefix='gifs:popular')
@log_requests
def get_popular_gifs():
    """Get popular GIFs from Tenor API v2."""
    try:
        limit = int(request.args.get('limit', 20))
        
        tenor_service = TenorService()
        
        # Check if API key is configured
        if not tenor_service.api_key:
            logger.warning("Tenor API key not configured")
            return jsonify({
                'success': True,
                'data': [],
                'message': 'Tenor API key not configured. Please set TENOR_API_KEY in environment variables.'
            }), 200
        
        result = tenor_service.get_popular_gifs(limit=limit)
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result['results']
            }), 200
        else:
            error_msg = result.get('error', 'Failed to get popular GIFs')
            logger.error(f"Tenor API error: {error_msg}")
            return jsonify({
                'success': False,
                'errors': [error_msg],
                'data': []
            }), 200
            
    except Exception as e:
        logger.error(f"Get popular GIFs error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'errors': [f'Failed to get popular GIFs: {str(e)}']
        }), 500


@gifs_bp.route('/recent', methods=['GET'])
@require_auth()
@cache_result(ttl=3600, key_prefix='gifs:recent')
@log_requests
def get_recent_gifs():
    """Get recent GIFs from Tenor API v2."""
    try:
        limit = int(request.args.get('limit', 20))
        
        tenor_service = TenorService()
        
        # Check if API key is configured
        if not tenor_service.api_key:
            logger.warning("Tenor API key not configured")
            return jsonify({
                'success': True,
                'data': [],
                'message': 'Tenor API key not configured. Please set TENOR_API_KEY in environment variables.'
            }), 200
        
        result = tenor_service.get_recent_gifs(limit=limit)
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result['results']
            }), 200
        else:
            error_msg = result.get('error', 'Failed to get recent GIFs')
            logger.error(f"Tenor API error: {error_msg}")
            return jsonify({
                'success': False,
                'errors': [error_msg],
                'data': []
            }), 200
            
    except Exception as e:
        logger.error(f"Get recent GIFs error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'errors': [f'Failed to get recent GIFs: {str(e)}']
        }), 500


@gifs_bp.route('/categories', methods=['GET'])
@require_auth()
@cache_result(ttl=86400, key_prefix='gifs:categories')
@log_requests
def get_categories():
    """Get GIF categories from Tenor."""
    try:
        locale = request.args.get('locale', 'en_US')
        
        tenor_service = TenorService()
        result = tenor_service.get_categories(locale=locale)
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result['tags']
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': [result.get('error', 'Failed to get categories')]
            }), 500
            
    except Exception as e:
        logger.error(f"Get categories error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'errors': [f'Failed to get categories: {str(e)}']
        }), 500


@gifs_bp.route('/register-share', methods=['POST'])
@require_auth()
@log_requests
def register_share():
    """Register a GIF share event with Tenor."""
    try:
        data = request.get_json()
        gif_id = data.get('gif_id', '').strip()
        query = data.get('query', '').strip()
        
        if not gif_id:
            return jsonify({
                'success': False,
                'errors': ['GIF ID is required']
            }), 400
        
        tenor_service = TenorService()
        success = tenor_service.register_share(gif_id=gif_id, query=query)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Share registered successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'errors': ['Failed to register share']
            }), 500
            
    except Exception as e:
        logger.error(f"Register share error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'errors': [f'Failed to register share: {str(e)}']
        }), 500

