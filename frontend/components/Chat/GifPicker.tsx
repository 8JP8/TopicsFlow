import React, { useState, useEffect, useRef } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface Gif {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
  size: number;
}

interface Category {
  name: string;
  path: string;
  image: string;
}

interface GifPickerProps {
  onSelectGif: (gifUrl: string) => void;
  onClose: () => void;
}

// Common GIF tags for autocomplete
const COMMON_TAGS = [
  'happy', 'sad', 'excited', 'angry', 'love', 'funny', 'cute', 'cool',
  'wow', 'yes', 'no', 'ok', 'hi', 'bye', 'thanks', 'sorry', 'congratulations',
  'birthday', 'party', 'dance', 'celebrate', 'win', 'fail', 'lol', 'omg',
  'sleepy', 'hungry', 'thirsty', 'tired', 'work', 'study', 'game', 'sport',
  'food', 'drink', 'coffee', 'pizza', 'cat', 'dog', 'animal', 'nature'
];

const GifPicker: React.FC<GifPickerProps> = ({ onSelectGif, onClose }) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [trendingGifs, setTrendingGifs] = useState<Gif[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'trending' | 'popular' | 'recent'>('trending');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryGifs, setCategoryGifs] = useState<Gif[]>([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showCategoriesGrid, setShowCategoriesGrid] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<'left' | 'right'>('right');

  // Load trending GIFs and categories on mount
  useEffect(() => {
    loadTrendingGifs();
    loadCategories();
  }, []);

  // Handle search with debounce and autocomplete
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (autocompleteHideTimeoutRef.current) {
      clearTimeout(autocompleteHideTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      // Show autocomplete suggestions
      const suggestions = COMMON_TAGS.filter(tag => 
        tag.toLowerCase().startsWith(searchQuery.toLowerCase())
      ).slice(0, 5);
      setAutocompleteSuggestions(suggestions);
      setShowAutocomplete(suggestions.length > 0);

      // Search after debounce
      searchTimeoutRef.current = setTimeout(() => {
        searchGifs(searchQuery);
        // Keep autocomplete visible for 2 seconds after GIFs load
        autocompleteHideTimeoutRef.current = setTimeout(() => {
          setShowAutocomplete(false);
        }, 2000);
      }, 500);
    } else {
      setGifs([]);
      setShowAutocomplete(false);
      setAutocompleteSuggestions([]);
      if (selectedCategory) {
        setSelectedCategory(null);
        setCategoryGifs([]);
      }
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (autocompleteHideTimeoutRef.current) {
        clearTimeout(autocompleteHideTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close on outside click (but not when clicking inside the container)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const loadTrendingGifs = async () => {
    try {
      setLoadingTrending(true);
      const response = await api.get(API_ENDPOINTS.GIFS.TRENDING, { limit: 20 });
      
      if (response.data.success) {
        setTrendingGifs(response.data.data || []);
      } else {
        const errorMsg = response.data.errors?.[0] || 'Failed to load trending GIFs';
        console.error('Failed to load trending GIFs:', errorMsg);
        setTrendingGifs([]);
      }
    } catch (error: any) {
      console.error('Failed to load trending GIFs:', error);
      setTrendingGifs([]);
    } finally {
      setLoadingTrending(false);
    }
  };

  const loadPopularGifs = async () => {
    try {
      setLoadingTrending(true);
      const response = await api.get(API_ENDPOINTS.GIFS.POPULAR, { limit: 20 });
      
      if (response.data.success) {
        setTrendingGifs(response.data.data || []);
      } else {
        const errorMsg = response.data.errors?.[0] || 'Failed to load popular GIFs';
        console.error('Failed to load popular GIFs:', errorMsg);
        setTrendingGifs([]);
      }
    } catch (error: any) {
      console.error('Failed to load popular GIFs:', error);
      setTrendingGifs([]);
    } finally {
      setLoadingTrending(false);
    }
  };

  const loadRecentGifs = async () => {
    try {
      setLoadingTrending(true);
      const response = await api.get(API_ENDPOINTS.GIFS.RECENT, { limit: 20 });
      
      if (response.data.success) {
        setTrendingGifs(response.data.data || []);
      } else {
        const errorMsg = response.data.errors?.[0] || 'Failed to load recent GIFs';
        console.error('Failed to load recent GIFs:', errorMsg);
        setTrendingGifs([]);
      }
    } catch (error: any) {
      console.error('Failed to load recent GIFs:', error);
      setTrendingGifs([]);
    } finally {
      setLoadingTrending(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.GIFS.CATEGORIES);
      
      if (response.data.success) {
        setCategories(response.data.data || []);
      } else {
        console.error('Failed to load categories:', response.data.errors?.[0]);
        setCategories([]);
      }
    } catch (error: any) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      return;
    }

    try {
      setLoading(true);
      // Don't hide autocomplete immediately - let it stay visible for a bit
      
      const params: any = {
        q: query,
        limit: 20,
      };

      const response = await api.get(API_ENDPOINTS.GIFS.SEARCH, params);
      
      if (response.data.success) {
        setGifs(response.data.data || []);
      } else {
        toast.error(t('toast.failedToSearchGifs'));
        setGifs([]);
      }
    } catch (error: any) {
      console.error('Failed to search GIFs:', error);
      toast.error(t('toast.failedToSearchGifs'));
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryGifs = async (categoryPath: string) => {
    try {
      setLoading(true);
      setSelectedCategory(categoryPath);
      setShowCategoriesGrid(false); // Hide categories grid when viewing category GIFs
      
      // Search for GIFs using the category name
      const categoryName = categoryPath.split('/').pop() || categoryPath;
      const response = await api.get(API_ENDPOINTS.GIFS.SEARCH, {
        q: categoryName,
        limit: 20,
      });
      
      if (response.data.success) {
        setCategoryGifs(response.data.data || []);
      } else {
        toast.error(t('toast.failedToLoadCategoryGifs'));
        setCategoryGifs([]);
      }
    } catch (error: any) {
      console.error('Failed to load category GIFs:', error);
      toast.error(t('toast.failedToLoadCategoryGifs'));
      setCategoryGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGifSelect = (gif: Gif) => {
    // Register share with Tenor (optional, helps improve search)
    api.post(API_ENDPOINTS.GIFS.REGISTER_SHARE, {
      gif_id: gif.id,
      query: searchQuery || selectedCategory || undefined,
    }).catch(err => {
      // Ignore errors - this is optional
      console.warn('Failed to register GIF share:', err);
    });

    onSelectGif(gif.url);
    onClose();
  };

  const handleAutocompleteSelect = (tag: string) => {
    setSearchQuery(tag);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleFilterChange = (filter: 'trending' | 'popular' | 'recent') => {
    setActiveFilter(filter);
    // Load appropriate GIFs based on filter
    if (filter === 'trending') {
      loadTrendingGifs();
    } else if (filter === 'popular') {
      loadPopularGifs();
    } else if (filter === 'recent') {
      loadRecentGifs();
    }
  };

  const showSearchResults = searchQuery.trim().length > 0;
  const showCategoryGifs = selectedCategory !== null && selectedCategory !== '' && !showSearchResults;
  const displayGifs = showCategoryGifs ? categoryGifs : (showSearchResults ? gifs : trendingGifs);
  const isLoading = loading || (showSearchResults ? false : loadingTrending);

  // Calculate position to avoid going off-screen
  useEffect(() => {
    const checkPosition = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // If positioned to the right and would go off-screen, switch to left
      if (rect.right > viewportWidth - 10) {
        setPosition('left');
      } else if (rect.left < 10) {
        setPosition('right');
      }
    };
    
    // Check position after a short delay to allow rendering
    setTimeout(checkPosition, 0);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute bottom-full mb-2 w-96 theme-bg-secondary border theme-border rounded-lg shadow-xl z-50 flex flex-col ${
        position === 'right' ? 'right-0' : 'left-0'
      }`}
      style={{ 
        maxWidth: 'min(384px, calc(100vw - 2rem))',
        maxHeight: 'min(500px, calc(100vh - 10rem))',
        height: '500px',
      }}
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      {/* Header */}
      <div className="p-3 border-b theme-border flex-shrink-0">
        <div className="flex items-center space-x-2 mb-3 relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (autocompleteSuggestions.length > 0) {
                setShowAutocomplete(true);
              }
            }}
            placeholder={t('gifPicker.searchPlaceholder')}
            className="flex-1 px-3 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary text-sm"
            onClick={(e) => e.stopPropagation()} // Prevent closing
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 theme-bg-tertiary rounded-lg hover:theme-bg-primary transition-colors"
          >
            <svg className="w-4 h-4 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Autocomplete dropdown */}
          {showAutocomplete && autocompleteSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-10 mt-1 theme-bg-secondary border theme-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
              {autocompleteSuggestions.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => handleAutocompleteSelect(tag)}
                  className="w-full px-3 py-2 text-left text-sm theme-text-primary hover:theme-bg-tertiary transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Buttons with Categories Icon */}
        {!showSearchResults && !showCategoryGifs && !showCategoriesGrid && (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-2 flex-1">
              <button
                onClick={() => handleFilterChange('trending')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeFilter === 'trending'
                    ? 'btn btn-secondary'
                    : 'theme-bg-tertiary theme-text-secondary hover:theme-text-primary'
                }`}
              >
                {t('gifPicker.trending')}
              </button>
              <button
                onClick={() => handleFilterChange('popular')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeFilter === 'popular'
                    ? 'btn btn-secondary'
                    : 'theme-bg-tertiary theme-text-secondary hover:theme-text-primary'
                }`}
              >
                {t('gifPicker.popular')}
              </button>
              <button
                onClick={() => handleFilterChange('recent')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeFilter === 'recent'
                    ? 'btn btn-secondary'
                    : 'theme-bg-tertiary theme-text-secondary hover:theme-text-primary'
                }`}
              >
                {t('gifPicker.recent')}
              </button>
            </div>
            {/* Categories Icon Button */}
            <button
              onClick={() => {
                setShowCategoriesGrid(true);
                setSelectedCategory('');
                setCategoryGifs([]);
                setSearchQuery('');
              }}
              className={`p-1.5 rounded transition-colors ${
                showCategoriesGrid
                  ? 'btn btn-secondary'
                  : 'theme-bg-tertiary theme-text-secondary hover:theme-text-primary'
              }`}
              title={t('gifPicker.categories')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {showCategoriesGrid ? (
          // Show categories grid
          <>
            <button
              onClick={() => {
                setShowCategoriesGrid(false);
                setSelectedCategory(null);
                setCategoryGifs([]);
              }}
              className="mb-3 text-xs theme-text-secondary hover:theme-text-primary flex items-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>{t('gifPicker.back')}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category, index) => (
                <button
                  key={index}
                  onClick={() => loadCategoryGifs(category.path)}
                  className="relative aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity group"
                >
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-xs font-medium text-white text-center">{category.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : showCategoryGifs ? (
          // Show category GIFs
          <>
            <button
              onClick={() => {
                setShowCategoriesGrid(true);
                setSelectedCategory(null);
                setCategoryGifs([]);
              }}
              className="mb-3 text-xs theme-text-secondary hover:theme-text-primary flex items-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>{t('gifPicker.backToCategories')}</span>
            </button>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : categoryGifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm theme-text-secondary">{t('gifPicker.noGifsInCategory')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categoryGifs.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => handleGifSelect(gif)}
                    className="relative aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity group"
                  >
                    <img
                      src={gif.preview_url || gif.url}
                      alt={gif.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : isLoading && displayGifs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : displayGifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="w-12 h-12 theme-text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm theme-text-secondary">{t('gifPicker.noGifsFound')}</p>
            <p className="text-xs theme-text-muted mt-1">
              {showSearchResults ? t('gifPicker.tryDifferentSearch') : t('gifPicker.noGifsAvailable')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {displayGifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleGifSelect(gif)}
                className="relative aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity group"
              >
                <img
                  src={gif.preview_url || gif.url}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="p-2 border-t theme-border text-center flex-shrink-0">
        <p className="text-xs theme-text-muted">
          {t('gifPicker.poweredBy')}{' '}
          <a
            href="https://tenor.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Tenor
          </a>
        </p>
      </div>
    </div>
  );
};

export default GifPicker;
