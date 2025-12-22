import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocket } from '@/contexts/SocketContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import InvitationsPopup from './InvitationsPopup';
import InvitationsModal from './InvitationsModal';

interface InvitationsButtonProps {
  onClickOverride?: () => void;
}

const InvitationsButton: React.FC<InvitationsButtonProps> = ({ onClickOverride }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket, connected } = useSocket();
  const [invitationCount, setInvitationCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);

  // Listen for tour event to open invitations
  useEffect(() => {
    const handleOpenInvitations = () => {
      if (onClickOverride) {
        onClickOverride();
      } else {
        setShowModal(true);
      }
    };
    window.addEventListener('tour:open-invitations', handleOpenInvitations);
    return () => window.removeEventListener('tour:open-invitations', handleOpenInvitations);
  }, [onClickOverride]);

  // Fetch pending invitations count (chat + topics)
  const fetchInvitationCount = async () => {
    if (!user) return;

    try {
      const [chatRes, topicRes] = await Promise.all([
        api.get(API_ENDPOINTS.CHAT_ROOMS.GET_INVITATIONS),
        api.get(API_ENDPOINTS.TOPICS.GET_INVITATIONS)
      ]);

      let total = 0;

      if (chatRes.data.success) {
        const pendingChatInvitations = (chatRes.data.data || []).filter((inv: any) => !inv.status || inv.status === 'pending');
        total += pendingChatInvitations.length;
      }

      if (topicRes.data.success) {
        const pendingTopicInvitations = (topicRes.data.data || []);
        total += pendingTopicInvitations.length;
      }

      setInvitationCount(total);
    } catch (error) {
      console.error('Failed to fetch invitation count:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInvitationCount();
    }
  }, [user]);

  // Listen for new invitations via WebSocket
  useEffect(() => {
    if (!socket || !connected || !user) return;

    const handleInvitation = () => {
      fetchInvitationCount();
    };

    // Listen for custom event dispatched by SocketContext
    const eventHandler = (event: CustomEvent) => {
      handleInvitation();
    };

    const refreshHandler = () => {
      handleInvitation();
    };

    window.addEventListener('chat_room_invitation', eventHandler as EventListener);
    window.addEventListener('refresh_invitations', refreshHandler);

    return () => {
      window.removeEventListener('chat_room_invitation', eventHandler as EventListener);
      window.removeEventListener('refresh_invitations', refreshHandler);
    };
  }, [socket, connected, user]);

  // Refresh count when modal closes
  const handleModalClose = () => {
    setShowModal(false);
    fetchInvitationCount();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (onClickOverride) {
            onClickOverride();
          } else {
            setShowModal(!showModal);
          }
        }}
        id="invitations-btn"
        className="relative p-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors"
        aria-label={t('invitations.title') || 'Chat Invitations'}
        title={t('tooltips.invitations') || 'Chat Invitations'}
      >
        <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>

        {invitationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
            {invitationCount > 99 ? '99+' : invitationCount}
          </span>
        )}
      </button>

      {/* Only render internal modals if NO override is provided. 
          If override is provided, the parent handles the modal. 
          Actually, let's keep it simple: if override is not used, show modals. */}
      {!onClickOverride && showModal && (
        <InvitationsPopup
          isOpen={showModal}
          onClose={handleModalClose}
          onInvitationHandled={fetchInvitationCount}
          onViewAll={() => {
            setShowModal(false);
            setShowFullModal(true);
          }}
        />
      )}

      {!onClickOverride && showFullModal && (
        <InvitationsModal
          isOpen={showFullModal}
          onClose={() => setShowFullModal(false)}
          onInvitationHandled={fetchInvitationCount}
        />
      )}
    </div>
  );
};

export default InvitationsButton;

