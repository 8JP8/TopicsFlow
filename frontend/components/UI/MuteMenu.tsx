import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';

interface MuteMenuProps {
  type: 'topic' | 'chat_room' | 'conversation' | 'post' | 'chat';
  id: string;
  name: string;
  onClose: () => void;
  isMuted?: boolean;
  isFollowing?: boolean; // For chatrooms
}

const MuteMenu: React.FC<MuteMenuProps> = ({ type, id, name, onClose, isMuted = false, isFollowing = false }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const muteOptions = [
    { label: t('mute.15minutes') || '15 minutes', minutes: 15 },
    { label: t('mute.1hour') || '1 hour', minutes: 60 },
    { label: t('mute.8hours') || '8 hours', minutes: 480 },
    { label: t('mute.24hours') || '24 hours', minutes: 1440 },
    { label: t('mute.forever') || 'Until I unmute', minutes: -1 },
  ];

  const handleMute = async (minutes: number) => {
    setLoading(true);
    try {
      let endpoint: string;
      
      if (type === 'topic') {
        endpoint = API_ENDPOINTS.NOTIFICATION_SETTINGS.MUTE_TOPIC(id);
      } else if (type === 'chat_room' || type === 'chat') {
        // Chatrooms now use follow/unfollow instead of mute
        endpoint = API_ENDPOINTS.NOTIFICATION_SETTINGS.FOLLOW_CHATROOM(id);
      } else if (type === 'post') {
        endpoint = API_ENDPOINTS.MUTE.MUTE_POST(id);
      } else {
        endpoint = API_ENDPOINTS.USERS.MUTE_CONVERSATION(id);
      }

      const response = await api.post(endpoint, (type === 'chat_room' || type === 'chat') ? {} : { minutes });

      if (response.data.success) {
        if (type === 'chat_room' || type === 'chat') {
          toast.success(t('mute.followed', { name }) || `Following ${name}`);  
        } else {
          const duration = minutes === -1 ? t('mute.forever') : `${minutes} ${t('common.minutes')}`;
          toast.success(t('mute.success', { name, duration }) || `${name} muted for ${duration}`);
        }
        onClose();
        // Optionally refresh the page or update state
        window.location.reload();
      } else {
        toast.error(t('mute.error') || 'Failed to mute');
      }
    } catch (error) {
      console.error('Mute error:', error);
      toast.error(t('mute.error') || 'Failed to mute');
    } finally {
      setLoading(false);
    }
  };

  const handleUnmute = async () => {
    setLoading(true);
    try {
      let endpoint: string;
      
      if (type === 'topic') {
        endpoint = API_ENDPOINTS.NOTIFICATION_SETTINGS.UNMUTE_TOPIC(id);
      } else if (type === 'chat_room' || type === 'chat') {
        // Chatrooms now use follow/unfollow instead of mute
        endpoint = API_ENDPOINTS.NOTIFICATION_SETTINGS.UNFOLLOW_CHATROOM(id);
      } else if (type === 'post') {
        endpoint = API_ENDPOINTS.MUTE.UNMUTE_POST(id);
      } else {
        endpoint = API_ENDPOINTS.USERS.MUTE_CONVERSATION(id);
      }

      const response = await api.post(endpoint, {});

      if (response.data.success) {
        if (type === 'chat_room' || type === 'chat') {
          toast.success(t('mute.unfollowed', { name }) || `${name} unfollowed`);
        } else {
          toast.success(t('mute.unmuted', { name }) || `${name} unmuted`);
        }
        onClose();
        // Optionally refresh the page or update state
        window.location.reload();
      } else {
        toast.error(t('mute.error') || 'Failed to unmute');
      }
    } catch (error) {
      console.error('Unmute error:', error);
      toast.error(t('mute.error') || 'Failed to unmute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="theme-bg-secondary rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold theme-text-primary">
              {isMuted ? (t('mute.unmute') || 'Unmute') : (t('mute.title') || 'Mute Notifications')}
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info */}
          <div className="mb-4">
            <p className="text-sm theme-text-muted">
              {(type === 'chat_room' || type === 'chat') ? (
                isFollowing 
                  ? (t('mute.currentlyFollowing', { name }) || `You are following ${name}`)
                  : (t('mute.followDescription', { name }) || `Follow ${name} to receive notifications`)
              ) : (
                isMuted 
                  ? (t('mute.currentlyMuted', { name }) || `${name} is currently muted`)
                  : (t('mute.description', { name }) || `Mute ${name} to stop receiving notifications`)
              )}
            </p>
          </div>

          {/* Options */}
          {(type === 'chat_room' || type === 'chat') ? (
            // For chatrooms, show simple follow/unfollow button
            <button
              onClick={isFollowing ? handleUnmute : () => handleMute(0)}
              disabled={loading}
              className="w-full px-4 py-3 text-left hover:theme-bg-tertiary rounded-lg transition-colors theme-text-primary flex items-center justify-between"
            >
              <span>{isFollowing ? (t('mute.unfollow') || 'Unfollow') : (t('mute.follow') || 'Follow')}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFollowing ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                )}
              </svg>
            </button>
          ) : isMuted ? (
            <button
              onClick={handleUnmute}
              disabled={loading}
              className="w-full px-4 py-3 text-left hover:theme-bg-tertiary rounded-lg transition-colors theme-text-primary flex items-center justify-between"
            >
              <span>{t('mute.unmute') || 'Unmute'}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          ) : (
            <div className="space-y-2">
              {muteOptions.map((option) => (
                <button
                  key={option.minutes}
                  onClick={() => handleMute(option.minutes)}
                  disabled={loading}
                  className="w-full px-4 py-3 text-left hover:theme-bg-tertiary rounded-lg transition-colors theme-text-primary flex items-center justify-between"
                >
                  <span>{option.label}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Cancel button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 btn btn-ghost"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MuteMenu;
