import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';

interface PostContextMenuProps {
  postId: string;
  postTitle: string;
  x: number;
  y: number;
  onClose: () => void;
  onFollow?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  isFollowed?: boolean;
  isHidden?: boolean;
  isOwner?: boolean;
}

const PostContextMenu: React.FC<PostContextMenuProps> = ({
  postId,
  postTitle,
  x,
  y,
  onClose,
  onFollow,
  onHide,
  onReport,
  onDelete,
  isFollowed = false,
  isHidden = false,
  isOwner = false,
}) => {
  const { t } = useLanguage();
  
  const items = [
    {
      label: t('posts.reportPost') || 'Report Post',
      action: () => {
        if (onReport) {
          onReport(postId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      disabled: !onReport,
    },
    {
      label: isFollowed ? (t('contextMenu.unfollowPost') || 'Unfollow Post') : (t('contextMenu.followPost') || 'Follow Post'),
      action: () => {
        if (onFollow) {
          onFollow(postId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isFollowed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          )}
        </svg>
      ),
      disabled: !onFollow,
    },
    {
      label: isHidden ? (t('contextMenu.unhidePost') || 'Unhide Post') : (t('contextMenu.hidePost') || 'Hide Post'),
      action: () => {
        if (onHide) {
          onHide(postId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ),
      disabled: !onHide,
    },
  ];

  // Add delete option for owners
  if (isOwner && onDelete) {
    items.push({
      label: t('posts.deletePost') || 'Delete Post',
      action: () => {
        if (onDelete) {
          onDelete(postId);
        }
        onClose();
      },
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      disabled: !onDelete,
    });
  }

  return (
    <ContextMenu items={items} onClose={onClose} x={x} y={y} />
  );
};

export default PostContextMenu;

