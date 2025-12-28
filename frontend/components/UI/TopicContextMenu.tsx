import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';
import { Bell, BellOff, Flag, Eye, EyeOff, Volume2, Trash2, LogOut as ArrowRightFromLine } from 'lucide-react';

interface TopicContextMenuProps {
  topicId: string;
  topicTitle: string;
  x: number;
  y: number;
  onClose: () => void;
  onSilence?: (topicId: string, minutes?: number) => void;
  onHide?: (topicId: string) => void;
  onDelete?: (topicId: string) => void;
  onFollow?: (topicId: string) => void;
  onReport?: (topicId: string) => void;
  isSilenced?: boolean;
  isHidden?: boolean;
  isOwner?: boolean;
  isFollowed?: boolean;
  isPrivate?: boolean;
}

const TopicContextMenu: React.FC<TopicContextMenuProps> = ({
  topicId,
  topicTitle,
  x,
  y,
  onClose,
  onSilence,
  onHide,
  onDelete,
  onFollow,
  onReport,
  isSilenced = false,
  isHidden = false,
  isOwner = false,
  isFollowed = false,
  isPrivate = false,
}) => {
  const { t } = useLanguage();

  const silenceSubmenu = [
    {
      label: t('mute.15minutes') || '15 minutes',
      action: () => {
        if (onSilence) onSilence(topicId, 15);
        onClose();
      },
    },
    {
      label: t('mute.1hour') || '1 hour',
      action: () => {
        if (onSilence) onSilence(topicId, 60);
        onClose();
      },
    },
    {
      label: t('mute.8hours') || '8 hours',
      action: () => {
        if (onSilence) onSilence(topicId, 480);
        onClose();
      },
    },
    {
      label: t('mute.24hours') || '24 hours',
      action: () => {
        if (onSilence) onSilence(topicId, 1440);
        onClose();
      },
    },
    {
      label: t('mute.forever') || 'Until I turn it back on',
      action: () => {
        if (onSilence) onSilence(topicId, -1);
        onClose();
      },
    },
  ];

  const items = [
    {
      label: t('topics.reportTopic') || 'Report Chat Room',
      action: () => {
        if (onReport) {
          onReport(topicId);
        }
        onClose();
      },
      icon: <Flag className="w-4 h-4" />,
      disabled: !onReport,
    },
    // Follow/Unfollow OR Leave logic
    // Leave Topic (for joined topics)
    {
      label: t('topics.leaveGroup') || 'Leave Topic',
      action: () => {
        if (onFollow) {
          // We are reusing onFollow as the "Leave" action handler for now based on previous code
          // Ideally this prop should be renamed onLeave in the parent, but to minimize breakage:
          onFollow(topicId);
        } else if (onDelete && !isOwner) {
          // Fallback or specific handler if onFollow isn't passed but onDelete is? No.
        }
        onClose();
      },
      icon: <ArrowRightFromLine className="w-4 h-4" />,
      // Show if we have a handler. We assume if the user can see "Leave", they are in it. 
      // The parent component controls visibility but here we can't easily check membership status 
      // unless passed. `isPrivate` was used as a proxy for "Group Chat". 
      // The user wants this for "invite only topics im in".
      // We will rely on the parent ensuring `onFollow` (mapped to leave) is passed only when appropriate,
      // OR we just show it if `onFollow` is present, acting as "Join/Leave" toggle but since we removed Join (Follow), it's just Leave?
      // Wait, if we remove Follow, how do they Join Public topics? The user said "remove all references to that and code".
      // Maybe they strictly mean "Following" as in updates, but "Joining" is membership.
      // "topics should only have the mute options override to not show any notification"
      // "button to leave the topic should be present for the invite only topics im in"
      // So public topics don't need Join/Leave? Or Public topics are just "browseable"?
      // I will assume for now we only show LEAVE.
      disabled: !onFollow,
      hidden: !isPrivate && !isFollowed // Hide if public and not followed/joined? 
      // Actually, let's just use the `isPrivate` flag as "is Member of Restricted Topic" proxy or ensure the parent passes `isFollowed` correctly for membership.
    },

    // Mute Options: Only appear if followed (or private/member)
    ...((isFollowed || isPrivate) ? [{
      label: isSilenced ? (t('contextMenu.unsilenced') || 'Unsilence') : (t('contextMenu.silence') || 'Silence'),
      action: isSilenced ? () => {
        if (onSilence) onSilence(topicId, 0);
        onClose();
      } : () => { },
      submenu: !isSilenced ? silenceSubmenu : undefined,
      icon: <Volume2 className="w-4 h-4" />,
      disabled: !onSilence,
    }] : []),

    {
      label: isHidden ? (t('contextMenu.unhideTopic') || 'Unhide') : (t('contextMenu.hideTopic') || 'Hide'),
      action: () => {
        if (onHide) {
          onHide(topicId);
        }
        onClose();
      },
      icon: isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />,
      disabled: !onHide,
    },
  ];

  // Add delete option for owners
  if (isOwner && onDelete) {
    items.push({
      label: t('contextMenu.deleteTopic') || 'Delete Chat Room',
      action: () => {
        if (onDelete) {
          onDelete(topicId);
        }
        onClose();
      },
      icon: <Trash2 className="w-4 h-4" />,
      disabled: !onDelete,
    });
  }

  return <ContextMenu items={items} onClose={onClose} x={x} y={y} />;
};

export default TopicContextMenu;
