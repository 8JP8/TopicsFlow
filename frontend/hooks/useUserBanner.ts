import { useState, useRef, useCallback, useEffect } from 'react';

interface UseUserBannerReturn {
  showBanner: boolean;
  bannerPos: { x: number; y: number } | null;
  selectedUser: { userId: string; username: string } | null;
  handleMouseEnter: (e: React.MouseEvent, userId: string, username: string) => void;
  handleMouseLeave: () => void;
  handleClick: (e: React.MouseEvent, userId: string, username: string) => void;
  handleClose: () => void;
}

const HOVER_DELAY = 1500; // 1.5 seconds

export const useUserBanner = (): UseUserBannerReturn => {
  const [showBanner, setShowBanner] = useState(false);
  const [bannerPos, setBannerPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; username: string } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent, userId: string, username: string) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Capture the element reference before the timeout
    const targetElement = e.currentTarget as HTMLElement;
    if (!targetElement) {
      return;
    }

    // Set a timeout to show banner after delay
    hoverTimeoutRef.current = setTimeout(() => {
      // Check if element still exists and is in the DOM
      if (!targetElement || !targetElement.getBoundingClientRect) {
        return;
      }

      try {
        const rect = targetElement.getBoundingClientRect();
        // Verify rect is valid (not all zeros, which can happen if element is hidden/removed)
        if (rect.width === 0 && rect.height === 0) {
          return;
        }

        setBannerPos({
          x: rect.left,
          y: rect.bottom + 5,
        });
        setSelectedUser({ userId, username });
        setShowBanner(true);
      } catch (error) {
        // Element may have been removed from DOM
        console.warn('Failed to get bounding rect for user banner:', error);
      }
    }, HOVER_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Clear timeout if user moves away before delay
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Don't hide immediately on mouse leave - let it stay visible
    // User can click outside or move mouse to banner
  }, []);

  const handleClick = useCallback((e: React.MouseEvent, userId: string, username: string) => {
    // Clear hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Show banner immediately on click
    const targetElement = e.currentTarget as HTMLElement;
    if (!targetElement || !targetElement.getBoundingClientRect) {
      return;
    }

    try {
      const rect = targetElement.getBoundingClientRect();
      // Verify rect is valid
      if (rect.width === 0 && rect.height === 0) {
        return;
      }

      setBannerPos({
        x: rect.left,
        y: rect.bottom + 5,
      });
      setSelectedUser({ userId, username });
      setShowBanner(true);
    } catch (error) {
      // Element may have been removed from DOM
      console.warn('Failed to get bounding rect for user banner on click:', error);
    }
  }, []);

  const handleClose = useCallback(() => {
    setShowBanner(false);
    setBannerPos(null);
    setSelectedUser(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    showBanner,
    bannerPos,
    selectedUser,
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
    handleClose,
  };
};



