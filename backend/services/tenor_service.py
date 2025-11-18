"""
Tenor GIF API Service
Handles GIF search and retrieval from Tenor API v2
"""
import requests
import logging
import os
import json
from typing import List, Dict, Optional, Any
from flask import current_app, has_app_context

logger = logging.getLogger(__name__)

class TenorService:
    """Service for interacting with Tenor GIF API v2."""
    
    BASE_URL_V1 = "https://g.tenor.com/v1"  # For register share
    BASE_URL_V2 = "https://tenor.googleapis.com/v2"  # For all other endpoints
    
    def __init__(self, api_key: Optional[str] = None, client_key: Optional[str] = None):
        """Initialize Tenor service with API key and client key."""
        if api_key:
            self.api_key = api_key
            logger.info(f"[TENOR] Using provided API key (length: {len(api_key)})")
        elif has_app_context():
            self.api_key = current_app.config.get('TENOR_API_KEY', '')
            if self.api_key:
                logger.info(f"[TENOR] Using API key from Flask config (length: {len(self.api_key)})")
            else:
                # Fallback to environment variable if not in config
                self.api_key = os.getenv('TENOR_API_KEY', '')
                if self.api_key:
                    logger.info(f"[TENOR] Using API key from environment variable (length: {len(self.api_key)})")
        else:
            # Fallback to environment variable if not in app context
            self.api_key = os.getenv('TENOR_API_KEY', '')
            if self.api_key:
                logger.info(f"[TENOR] Using API key from environment variable (no app context, length: {len(self.api_key)})")
        
        # Client key for v2 API
        if client_key:
            self.client_key = client_key
        elif has_app_context():
            self.client_key = current_app.config.get('TENOR_CLIENT_KEY', 'chathub_app')
        else:
            self.client_key = os.getenv('TENOR_CLIENT_KEY', 'chathub_app')
        
        if not self.api_key:
            logger.warning("Tenor API key not configured. GIF search will be disabled.")
        else:
            logger.info(f"[TENOR] API key configured successfully (first 10 chars: {self.api_key[:10]}...)")
            logger.info(f"[TENOR] Client key: {self.client_key}")
    
    def search_gifs(self, query: str, limit: int = 20, client_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Search for GIFs using Tenor API v2.
        
        Args:
            query: Search query string
            limit: Number of results (1-50)
            client_key: Client key for the integration (optional, uses default if not provided)
        
        Returns:
            Dictionary with search results
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Tenor API key not configured',
                'results': [],
            }
        
        try:
            ckey = client_key or self.client_key
            url = f"{self.BASE_URL_V2}/search?q={query}&key={self.api_key}&client_key={ckey}&limit={limit}"
            
            r = requests.get(url, timeout=10)
            
            if r.status_code == 200:
                top_gifs = json.loads(r.content)
                
                # Format results for frontend
                results = []
                for gif in top_gifs.get('results', []):
                    # Extract media formats
                    media_formats = gif.get('media_formats', {})
                    
                    # Get GIF URL (prefer smaller formats for faster loading)
                    gif_url = None
                    preview_url = None
                    
                    if 'gif' in media_formats:
                        gif_url = media_formats['gif'].get('url')
                    elif 'tinygif' in media_formats:
                        gif_url = media_formats['tinygif'].get('url')
                    elif 'mp4' in media_formats:
                        gif_url = media_formats['mp4'].get('url')
                    
                    if 'tinygif' in media_formats:
                        preview_url = media_formats['tinygif'].get('url')
                    elif 'nanogif' in media_formats:
                        preview_url = media_formats['nanogif'].get('url')
                    else:
                        preview_url = gif_url
                    
                    if not gif_url:
                        logger.warning(f"GIF {gif.get('id')} has no URL, skipping")
                        continue
                    
                    # Get dimensions
                    dims = media_formats.get('gif', {}).get('dims', [0, 0])
                    if not dims and 'tinygif' in media_formats:
                        dims = media_formats['tinygif'].get('dims', [0, 0])
                    
                    results.append({
                        'id': str(gif.get('id', '')),
                        'title': gif.get('title', ''),
                        'url': gif_url,
                        'preview_url': preview_url or gif_url,
                        'width': dims[0] if dims and len(dims) >= 1 else 0,
                        'height': dims[1] if dims and len(dims) >= 2 else 0,
                    })
                
                return {
                    'success': True,
                    'results': results,
                }
            else:
                return {
                    'success': False,
                    'error': f'API returned status {r.status_code}',
                    'results': [],
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Tenor API request failed: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to search GIFs: {str(e)}',
                'results': [],
            }
        except Exception as e:
            logger.error(f"Tenor API error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'results': [],
            }
    
    def get_featured_gifs(self, limit: int = 10, client_key: Optional[str] = None, locale: str = 'en_US') -> Dict[str, Any]:
        """
        Get featured GIFs from Tenor API v2 (replaces trending).
        
        Args:
            limit: Number of results (1-50)
            client_key: Client key for the integration (optional)
            locale: Locale code (default: en_US)
        
        Returns:
            Dictionary with featured GIFs
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Tenor API key not configured',
                'results': []
            }
        
        try:
            ckey = client_key or self.client_key
            url = f"{self.BASE_URL_V2}/featured?key={self.api_key}&client_key={ckey}&limit={limit}"
            if locale != 'en_US':
                url += f"&locale={locale}"
            
            r = requests.get(url, timeout=10)
            
            if r.status_code == 200:
                featured_gifs = json.loads(r.content)
                
                # Format results for frontend
                results = []
                for gif in featured_gifs.get('results', []):
                    media_formats = gif.get('media_formats', {})
                    
                    gif_url = None
                    preview_url = None
                    
                    if 'gif' in media_formats:
                        gif_url = media_formats['gif'].get('url')
                    elif 'tinygif' in media_formats:
                        gif_url = media_formats['tinygif'].get('url')
                    elif 'mp4' in media_formats:
                        gif_url = media_formats['mp4'].get('url')
                    
                    if 'tinygif' in media_formats:
                        preview_url = media_formats['tinygif'].get('url')
                    elif 'nanogif' in media_formats:
                        preview_url = media_formats['nanogif'].get('url')
                    else:
                        preview_url = gif_url
                    
                    if not gif_url:
                        logger.warning(f"GIF {gif.get('id')} has no URL, skipping")
                        continue
                    
                    dims = media_formats.get('gif', {}).get('dims', [0, 0])
                    if not dims and 'tinygif' in media_formats:
                        dims = media_formats['tinygif'].get('dims', [0, 0])
                    
                    results.append({
                        'id': str(gif.get('id', '')),
                        'title': gif.get('title', ''),
                        'url': gif_url,
                        'preview_url': preview_url or gif_url,
                        'width': dims[0] if dims and len(dims) >= 1 else 0,
                        'height': dims[1] if dims and len(dims) >= 2 else 0,
                    })
                
                return {
                    'success': True,
                    'results': results,
                }
            else:
                return {
                    'success': False,
                    'error': f'API returned status {r.status_code}',
                    'results': []
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Tenor API request failed: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to get featured GIFs: {str(e)}',
                'results': []
            }
        except Exception as e:
            logger.error(f"Tenor API error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'results': []
            }
    
    def get_trending_gifs(self, limit: int = 20, content_filter: str = 'medium',
                         media_filter: str = 'basic', locale: str = 'en_US') -> Dict[str, Any]:
        """
        Get trending GIFs from Tenor (deprecated, use get_featured_gifs instead).
        This method calls get_featured_gifs for backward compatibility.
        """
        return self.get_featured_gifs(limit=limit, locale=locale)
    
    def get_popular_gifs(self, limit: int = 20, client_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Get popular GIFs using search with popular terms.
        
        Args:
            limit: Number of results (1-50)
            client_key: Client key for the integration (optional)
        
        Returns:
            Dictionary with popular GIFs
        """
        # Use search with popular/viral terms
        return self.search_gifs(query="popular viral trending", limit=limit, client_key=client_key)
    
    def get_recent_gifs(self, limit: int = 20, client_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Get recent/new GIFs using search with recent terms.
        
        Args:
            limit: Number of results (1-50)
            client_key: Client key for the integration (optional)
        
        Returns:
            Dictionary with recent GIFs
        """
        # Use search with recent/new terms
        return self.search_gifs(query="new recent latest", limit=limit, client_key=client_key)
    
    def get_categories(self, client_key: Optional[str] = None, locale: str = 'en_US') -> Dict[str, Any]:
        """
        Get GIF categories from Tenor API v2.
        
        Args:
            client_key: Client key for the integration (optional)
            locale: Locale code (default: en_US)
        
        Returns:
            Dictionary with categories
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Tenor API key not configured',
                'tags': []
            }
        
        try:
            ckey = client_key or self.client_key
            url = f"{self.BASE_URL_V2}/categories?key={self.api_key}&client_key={ckey}"
            if locale != 'en_US':
                url += f"&locale={locale}"
            
            r = requests.get(url, timeout=10)
            
            if r.status_code == 200:
                categories = json.loads(r.content)
                
                tags = []
                for tag in categories.get('tags', []):
                    tags.append({
                        'name': tag.get('name', ''),
                        'path': tag.get('path', ''),
                        'image': tag.get('image', ''),
                    })
                
                return {
                    'success': True,
                    'tags': tags,
                }
            else:
                return {
                    'success': False,
                    'error': f'API returned status {r.status_code}',
                    'tags': []
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Tenor API request failed: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to get categories: {str(e)}',
                'tags': []
            }
        except Exception as e:
            logger.error(f"Tenor API error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'tags': []
            }
    
    def get_autocomplete(self, query: str, limit: int = 5, client_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Get autocomplete suggestions for a partial search query.
        
        Args:
            query: Partial search query
            limit: Number of suggestions (1-50)
            client_key: Client key for the integration (optional)
        
        Returns:
            Dictionary with autocomplete suggestions
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Tenor API key not configured',
                'results': []
            }
        
        try:
            ckey = client_key or self.client_key
            url = f"{self.BASE_URL_V2}/autocomplete?key={self.api_key}&client_key={ckey}&q={query}&limit={limit}"
            
            r = requests.get(url, timeout=10)
            
            if r.status_code == 200:
                autocomplete_data = json.loads(r.content)
                search_term_list = autocomplete_data.get('results', [])
                
                return {
                    'success': True,
                    'results': search_term_list,
                }
            else:
                return {
                    'success': False,
                    'error': f'API returned status {r.status_code}',
                    'results': []
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Tenor API request failed: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to get autocomplete: {str(e)}',
                'results': []
            }
        except Exception as e:
            logger.error(f"Tenor API error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'results': []
            }
    
    def get_search_suggestions(self, query: str, limit: int = 5, client_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Get search suggestions for a query.
        
        Args:
            query: Search query
            limit: Number of suggestions (1-50)
            client_key: Client key for the integration (optional)
        
        Returns:
            Dictionary with search suggestions
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Tenor API key not configured',
                'results': []
            }
        
        try:
            ckey = client_key or self.client_key
            url = f"{self.BASE_URL_V2}/search_suggestions?key={self.api_key}&client_key={ckey}&q={query}&limit={limit}"
            
            r = requests.get(url, timeout=10)
            
            if r.status_code == 200:
                suggestions_data = json.loads(r.content)
                search_suggestion_list = suggestions_data.get('results', [])
                
                return {
                    'success': True,
                    'results': search_suggestion_list,
                }
            else:
                return {
                    'success': False,
                    'error': f'API returned status {r.status_code}',
                    'results': []
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Tenor API request failed: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to get search suggestions: {str(e)}',
                'results': []
            }
        except Exception as e:
            logger.error(f"Tenor API error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'results': []
            }
    
    def register_share(self, gif_id: str, query: str = '') -> bool:
        """
        Register a GIF share event with Tenor (helps improve search results).
        Uses v1 API endpoint.
        
        Args:
            gif_id: Tenor GIF ID
            query: Search query that led to this GIF
        
        Returns:
            True if successful
        """
        if not self.api_key:
            return False
        
        try:
            # Build URL with query parameters (matching Tenor API example format)
            url = f"{self.BASE_URL_V1}/registershare?id={gif_id}&key={self.api_key}"
            if query:
                url += f"&q={query}"
            
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                return True
            else:
                logger.warning(f"Failed to register GIF share: status {response.status_code}")
                return False
            
        except Exception as e:
            logger.warning(f"Failed to register GIF share: {str(e)}")
            return False
