import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ResizableSidebarProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
}

const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  children,
  defaultWidth = 400,
  minWidth = 250,
  maxWidth = 600,
  onWidthChange,
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

  // Apply presets based on window width
  useEffect(() => {
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    // Inverted: dragging right increases width, dragging left decreases width
    const diff = e.clientX - startXRef.current;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));

    setWidth(newWidth);
    localStorage.setItem('sidebar-width', newWidth.toString());
    if (onWidthChange) {
      onWidthChange(newWidth);
    }
  }, [isResizing, minWidth, maxWidth, onWidthChange]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      id="sidebar"
      ref={sidebarRef}
      className="relative flex flex-col"
      style={{ width: `${width}px` }}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors ${isResizing ? 'bg-blue-500' : 'bg-transparent'
          }`}
        style={{ zIndex: 10 }}
      />
    </div>
  );
};

export default ResizableSidebar;

