import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ResizableSidebarProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
}

const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  children,
  defaultWidth = 400,
  minWidth = 250,
  maxWidth = 600,
  onWidthChange,
  className,
}) => {
  const [width, setWidth] = useState(() => {
    // Load from localStorage or use default
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-width');
      return saved ? parseInt(saved, 10) : defaultWidth;
    }
    return defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile breakpoint
  useEffect(() => {
    const handleResizeCheck = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };

    handleResizeCheck();
    window.addEventListener('resize', handleResizeCheck);
    return () => window.removeEventListener('resize', handleResizeCheck);
  }, []);

  // Apply presets based on window width
  useEffect(() => {
    // ... existing handleResize logic ...
    // But actually I need to preserve the handleResize logic from lines 32-64 roughly, or just acknowledge it exists.
    // The user asked me to REPLACE lines.
    // I will just insert the new state and effect at the top of component body.
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      let presetWidth = defaultWidth;

      if (windowWidth < 768) {
        // Mobile: smaller sidebar
        presetWidth = 280;
      } else if (windowWidth < 1024) {
        // Tablet: medium sidebar
        presetWidth = 320;
      } else if (windowWidth < 1440) {
        // Desktop: default
        presetWidth = 400;
      } else {
        // Large desktop: bigger sidebar
        presetWidth = 450;
      }

      // Only apply preset if user hasn't manually resized
      const hasManualWidth = localStorage.getItem('sidebar-width');
      if (!hasManualWidth) {
        setWidth(presetWidth);
        if (onWidthChange) {
          onWidthChange(presetWidth);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [defaultWidth, onWidthChange]);

  // Divider drag handlers - Optimized for smoothness
  const requestRef = useRef<number>();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsResizing(true);
    startXRef.current = e.touches[0].clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
  }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  const updateWidth = useCallback((clientX: number) => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    requestRef.current = requestAnimationFrame(() => {
      const diff = clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));

      setWidth(newWidth);
      localStorage.setItem('sidebar-width', newWidth.toString());
      if (onWidthChange) {
        onWidthChange(newWidth);
      }
    });
  }, [minWidth, maxWidth, onWidthChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    updateWidth(e.clientX);
  }, [isResizing, updateWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isResizing) return;
    updateWidth(e.touches[0].clientX);
  }, [isResizing, updateWidth]);

  const handleDragEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.style.touchAction = '';
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isResizing, handleMouseMove, handleTouchMove, handleDragEnd]);

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div
      id="sidebar"
      ref={sidebarRef}
      className={`relative flex flex-col h-full ${isMobile ? 'w-full' : ''} ${className || ''}`}
      style={{ width: isMobile ? '100%' : `${width}px` }}
    >
      {children}
      <div className="absolute right-0 top-0 bottom-0 w-1 theme-border border-r z-20">
        {/* Invisible Hit Area for easier grabbing */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize z-30"
          style={{ touchAction: 'none' }}
        />
        {/* Visible Divider Line */}
        <div
          className={`absolute inset-0 transition-colors ${isResizing ? 'bg-blue-500' : 'hover:bg-blue-500 bg-transparent'
            }`}
        />
      </div>
    </div>
  );
};

export default ResizableSidebar;

