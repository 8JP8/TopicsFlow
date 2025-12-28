import React, { useEffect, useRef, useState } from 'react';

interface ContextMenuItem {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  onClose: () => void;
  x: number;
  y: number;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ items, onClose, x, y }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState<number | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ x: number; y: number; alignX?: 'left' | 'right'; alignY?: 'top' | 'bottom' } | null>(null);
  const [position, setPosition] = useState({ x, y });

  // Handle smart positioning for Main Menu
  React.useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      // Check horizontals
      if (x + rect.width > viewportWidth) {
        newX = x - rect.width; // Flip to left
      }
      // Ensure strictly within bounds (clamping)
      if (newX + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 10;
      }
      if (newX < 0) {
        newX = 10;
      }

      // Check verticals
      if (y + rect.height > viewportHeight) {
        newY = y - rect.height; // Flip to up
      }
      // Ensure strictly within bounds
      if (newY + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 10;
      }
      if (newY < 0) {
        newY = 10;
      }

      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  // Handle submenu positioning
  const handleItemClick = (item: ContextMenuItem, index: number, event: React.MouseEvent) => {
    if (item.disabled) return;

    if (item.submenu && item.submenu.length > 0) {
      // Open submenu with smart positioning
      const rect = event.currentTarget.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Default: Open to the right, aligned top
      let alignX: 'left' | 'right' = 'right';
      let alignY: 'top' | 'bottom' = 'top';

      // Check horizontal space (assume submenu ~200px)
      if (rect.right + 200 > viewportWidth) {
        alignX = 'left';
      }

      // Check vertical space (assume submenu based on item count, roughly 40px per item)
      const estimatedHeight = item.submenu.length * 40;
      if (rect.top + estimatedHeight > viewportHeight) {
        alignY = 'bottom';
      }

      const newPos = {
        x: alignX === 'right' ? rect.right : rect.left,
        y: alignY === 'top' ? rect.top : rect.bottom,
        alignX,
        alignY
      };

      setSubmenuPosition(newPos);
      setSubmenuOpen(index);
    } else {
      item.action();
      onClose();
    }
  };

  const handleSubmenuItemClick = (item: ContextMenuItem) => {
    if (item.disabled) return;
    item.action();
    onClose();
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 theme-bg-secondary border theme-border rounded-lg shadow-xl py-1 min-w-[180px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => (
          <div key={index} className="relative">
            <button
              onClick={(e) => handleItemClick(item, index, e)}
              disabled={item.disabled}
              className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${item.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'theme-text-primary hover:theme-bg-tertiary'
                } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.submenu && item.submenu.length > 0 && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
            {submenuOpen === index && item.submenu && submenuPosition && (
              <div
                className="fixed z-50 theme-bg-secondary border theme-border rounded-lg shadow-xl py-1 min-w-[180px]"
                style={{
                  // Horizontal: if align right (default), set left=x. If align left, set right=(width-x).
                  ...(submenuPosition.alignX === 'right'
                    ? { left: `${submenuPosition.x}px` }
                    : { right: `${window.innerWidth - submenuPosition.x}px`, left: 'auto' }),

                  // Vertical: if align top (default), set top=y. If align bottom, set bottom=(height-y).
                  ...(submenuPosition.alignY === 'top'
                    ? { top: `${submenuPosition.y}px` }
                    : { bottom: `${window.innerHeight - submenuPosition.y}px`, top: 'auto' }),
                }}
                onMouseLeave={() => setSubmenuOpen(null)}
              >
                {item.submenu.map((subItem, subIndex) => (
                  <button
                    key={subIndex}
                    onClick={() => handleSubmenuItemClick(subItem)}
                    disabled={subItem.disabled}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${subItem.danger
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'theme-text-primary hover:theme-bg-tertiary'
                      } ${subItem.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {subItem.icon && <span className="w-4 h-4">{subItem.icon}</span>}
                    <span>{subItem.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {submenuOpen !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSubmenuOpen(null)}
        />
      )}
    </>
  );
};

export default ContextMenu;

