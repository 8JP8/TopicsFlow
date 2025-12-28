import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';
import { Bell, BellOff, Flag, Eye, EyeOff, Volume2, Trash2, Share2 } from 'lucide-react';

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
  onSilence?: (postId: string, minutes?: number) => void;
  onShare?: (postId: string) => void;
  onReportUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  authorId?: string;
  authorUsername?: string;
  isFollowed?: boolean;
  isHidden?: boolean;
  isSilenced?: boolean;
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
  onSilence,
  onShare,
  onReportUser,
  onBlockUser,
  authorId,
  authorUsername,
  isFollowed = false,
  isHidden = false,
  isSilenced = false,
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
      icon: <Flag className="w-4 h-4" />,
      disabled: !onReport,
    },
    {
      label: t('contextMenu.sharePost') || 'Share Post',
      action: () => {
        if (onShare) {
          onShare(postId);
        }
        onClose();
      },
      icon: <Share2 className="w-4 h-4" />,
      disabled: !onShare,
    },
    {
      label: isFollowed ? (t('contextMenu.unfollowPost') || 'Unfollow Post') : (t('contextMenu.followPost') || 'Follow Post'),
      action: () => {
        if (onFollow) {
          onFollow(postId);
        }
        onClose();
      },
      icon: isFollowed ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />,
      disabled: !onFollow,
    },
    // Mute Options: Only if followed
    ...(isFollowed ? [{
      label: isSilenced ? (t('mute.unmutePost') || 'Unmute Post') : (t('mute.mutePost') || 'Mute Post'),
      action: () => {
        if (isSilenced) {
          if (onSilence) onSilence(postId, 0);
          onClose();
        }
      },
      icon: isSilenced ? <Volume2 className="w-4 h-4" /> : (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-off-icon lucide-volume-off w-4 h-4">
          <path d="M16 9a5 5 0 0 1 .95 2.293" />
          <path d="M19.364 5.636a9 9 0 0 1 1.889 9.96" />
          <path d="m2 2 20 20" />
          <path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11" />
          <path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686" />
        </svg>
      ),
      disabled: !onSilence,
      submenu: !isSilenced ? [
        { label: t('mute.15minutes') || '15 Minutes', action: () => { if (onSilence) onSilence(postId, 15); onClose(); } },
        { label: t('mute.1hour') || '1 Hour', action: () => { if (onSilence) onSilence(postId, 60); onClose(); } },
        { label: t('mute.8hours') || '8 Hours', action: () => { if (onSilence) onSilence(postId, 480); onClose(); } },
        { label: t('mute.24hours') || '24 Hours', action: () => { if (onSilence) onSilence(postId, 1440); onClose(); } },
        { label: t('mute.forever') || 'Forever', action: () => { if (onSilence) onSilence(postId, -1); onClose(); } },
      ] : undefined
    }] : []),
    {
      label: isHidden ? (t('contextMenu.unhidePost') || 'Unhide Post') : (t('contextMenu.hidePost') || 'Hide Post'),
      action: () => {
        if (onHide) {
          onHide(postId);
        }
        onClose();
      },
      icon: isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />,
      disabled: !onHide,
    },
  ];

  // User Actions (Report User, Block User)
  if (authorId && (onReportUser || onBlockUser)) {
    // Optional: Add separator logic in ContextMenu if supported, for now just append
    if (onReportUser) {
      items.push({
        label: t('contextMenu.reportUser') || 'Report User',
        action: () => {
          onReportUser(authorId);
          onClose();
        },
        icon: <Flag className="w-4 h-4" />, // Reusing Flag or use UserX maybe?
        disabled: false,
      });
    }
    if (onBlockUser) {
      items.push({
        label: t('userBanner.block') || 'Block User',
        action: () => {
          onBlockUser(authorId);
          onClose();
        },
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ban w-4 h-4"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>,
        disabled: false
      })
    }
  }


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
      icon: <Trash2 className="w-4 h-4" />,
      disabled: !onDelete,
    });
  }

  return (
    <ContextMenu items={items} onClose={onClose} x={x} y={y} />
  );
};

export default PostContextMenu;

