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
  const [submenuPosition, setSubmenuPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleItemClick = (item: ContextMenuItem, index: number, event: React.MouseEvent) => {
    if (item.disabled) return;

    if (item.submenu && item.submenu.length > 0) {
      // Open submenu
      const rect = event.currentTarget.getBoundingClientRect();
      setSubmenuPosition({ x: rect.right, y: rect.top });
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
          left: `${x}px`,
          top: `${y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => (
          <div key={index} className="relative">
            <button
              onClick={(e) => handleItemClick(item, index, e)}
              disabled={item.disabled}
              className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${
                item.danger
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
                  left: `${submenuPosition.x}px`,
                  top: `${submenuPosition.y}px`,
                }}
                onMouseLeave={() => setSubmenuOpen(null)}
              >
                {item.submenu.map((subItem, subIndex) => (
                  <button
                    key={subIndex}
                    onClick={() => handleSubmenuItemClick(subItem)}
                    disabled={subItem.disabled}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${
                      subItem.danger
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

