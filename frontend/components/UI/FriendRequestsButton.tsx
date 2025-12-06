import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import FriendRequestsModal from './FriendRequestsModal';

interface FriendRequestsButtonProps {}

const FriendRequestsButton: React.FC<FriendRequestsButtonProps> = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchFriendRequestCount();
      // Refresh count periodically
      const interval = setInterval(fetchFriendRequestCount, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchFriendRequestCount = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.FRIEND_REQUESTS);
      if (response.data.success) {
        const data = response.data.data || {received: [], sent: []};
        setFriendRequestCount(data.received?.length || 0);
      }
    } catch (error) {
      console.error('Failed to load friend request count:', error);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    fetchFriendRequestCount();
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="relative p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
        aria-label={t('privateMessages.friendRequests') || 'Friend Requests'}
        title={t('privateMessages.friendRequests') || 'Friend Requests'}
      >
        <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>

        {friendRequestCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {friendRequestCount > 99 ? '99+' : friendRequestCount}
          </span>
        )}
      </button>

      {showModal && (
        <FriendRequestsModal
          isOpen={showModal}
          onClose={handleModalClose}
          onRequestHandled={fetchFriendRequestCount}
        />
      )}
    </>
  );
};

export default FriendRequestsButton;

