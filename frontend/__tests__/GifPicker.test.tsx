/**
 * Frontend Tests for GifPicker Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import GifPicker from '@/components/Chat/GifPicker';
import { api } from '@/utils/api';

// Mock API
jest.mock('@/utils/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('GifPicker', () => {
  const onSelectGif = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'gif-1',
            title: 'Test GIF',
            url: 'https://example.com/gif.gif',
            preview_url: 'https://example.com/gif-preview.gif',
            width: 200,
            height: 200,
            size: 1000,
          },
        ],
      },
    });
  });

  it('should render GIF picker', () => {
    render(<GifPicker onSelectGif={onSelectGif} onClose={onClose} />);
    expect(screen.getByPlaceholderText(/search gifs/i)).toBeInTheDocument();
  });

  it('should load trending GIFs on mount', async () => {
    render(<GifPicker onSelectGif={onSelectGif} onClose={onClose} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/gifs/trending', { limit: 20 });
    });
  });

  it('should search GIFs when typing', async () => {
    render(<GifPicker onSelectGif={onSelectGif} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/search gifs/i);
    fireEvent.change(input, { target: { value: 'happy' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/gifs/search', {
        q: 'happy',
        limit: 20,
      });
    }, { timeout: 1000 });
  });

  it('should call onSelectGif when GIF is clicked', async () => {
    render(<GifPicker onSelectGif={onSelectGif} onClose={onClose} />);
    
    await waitFor(() => {
      const gifButton = screen.getByAltText('Test GIF');
      fireEvent.click(gifButton);
    });

    expect(onSelectGif).toHaveBeenCalledWith('https://example.com/gif.gif');
    expect(onClose).toHaveBeenCalled();
  });
});

