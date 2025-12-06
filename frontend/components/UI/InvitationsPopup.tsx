import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import Avatar from './Avatar';
import InvitationsModal from './InvitationsModal';

interface Invitation {
  id: string;
  room_id: string;
  room_name: string;
  room_description?: string;
  topic_id?: string;
  background_picture?: string;
  invited_by: {
    id: string;
    username: string;
  };
  created_at: string;
}

interface InvitationsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onInvitationHandled?: () => void;
}

const InvitationsPopup: React.FC<InvitationsPopupProps> = ({
  isOpen,
  onClose,
  onInvitationHandled,
}) => {
  const { t } = useLanguage();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
    }
  }, [isOpen]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_INVITATIONS);
      if (response.data.success) {
        const pending = (response.data.data || []).filter((inv: any) => !inv.status || inv.status === 'pending');
        setInvitations(pending);
      }
    } catch (error: any) {
      console.error('Failed to fetch invitations:', error);
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToLoad') || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string, roomId: string) => {
    try {
      setProcessing(invitationId);
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.ACCEPT_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('invitations.accepted') || 'Invitation accepted');
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('invitations.failedToAccept') || 'Failed to accept invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToAccept') || 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      setProcessing(invitationId);
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.DECLINE_INVITATION(invitationId));
      if (response.data.success) {
        toast.success(t('invitations.declined') || 'Invitation declined');
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        onInvitationHandled?.();
      } else {
        toast.error(response.data.errors?.[0] || t('invitations.failedToDecline') || 'Failed to decline invitation');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('invitations.failedToDecline') || 'Failed to decline invitation');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('notifications.justNow') || 'Just now';
    if (minutes < 60) return `${minutes} ${t('posts.minutes')} ${t('posts.ago')}`;
    if (hours < 24) return `${hours} ${t('posts.hours')} ${t('posts.ago')}`;
    if (days < 7) return `${days} ${t('posts.days')} ${t('posts.ago')}`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  // Show modal if expanded
  if (showModal) {
    return (
      <InvitationsModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          onClose();
        }}
        onInvitationHandled={onInvitationHandled}
      />
    );
  }

  // Show popup
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-20 z-40"
        onClick={onClose}
      />

      {/* Popup */}
      <div className="fixed top-16 right-4 z-50 pointer-events-none">
        <div
          className="theme-bg-secondary border theme-border rounded-lg shadow-xl w-80 max-h-[70vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b theme-border">
            <h3 className="text-sm font-semibold theme-text-primary">
              {t('invitations.title') || 'Chat Invitations'}
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowModal(true)}
                className="p-1 rounded hover:theme-bg-tertiary transition-colors"
                title={t('invitations.expand') || 'Expand'}
              >
                <svg className="w-4 h-4 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded hover:theme-bg-tertiary transition-colors"
              >
                <svg className="w-4 h-4 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm theme-text-secondary">
                  {t('invitations.noInvitations') || 'No pending invitations'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.slice(0, 3).map((invitation) => (
                  <div
                    key={invitation.id}
                    className="p-3 rounded-lg border theme-border theme-bg-tertiary"
                  >
                    <div className="flex items-start space-x-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium theme-text-primary truncate">
                          {invitation.room_name}
                        </h4>
                        <div className="flex items-center space-x-1 mt-1">
                          <Avatar
                            userId={invitation.invited_by.id}
                            username={invitation.invited_by.username}
                            size="xs"
                          />
                          <span className="text-xs theme-text-muted">
                            {invitation.invited_by.username}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        onClick={() => handleAccept(invitation.id, invitation.room_id)}
                        disabled={processing === invitation.id}
                        className="flex-1 px-2 py-1.5 text-xs btn btn-primary disabled:opacity-50"
                      >
                        {processing === invitation.id ? (
                          <LoadingSpinner size="xs" />
                        ) : (
                          t('invitations.accept') || 'Accept'
                        )}
                      </button>
                      <button
                        onClick={() => handleDecline(invitation.id)}
                        disabled={processing === invitation.id}
                        className="flex-1 px-2 py-1.5 text-xs btn btn-secondary disabled:opacity-50"
                      >
                        {processing === invitation.id ? (
                          <LoadingSpinner size="xs" />
                        ) : (
                          t('invitations.decline') || 'Decline'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {invitations.length > 3 && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="w-full py-2 text-sm theme-bg-tertiary theme-text-primary rounded-lg hover:theme-bg-hover transition-colors"
                  >
                    {t('invitations.viewAll', { count: invitations.length - 3 }) || `View ${invitations.length - 3} more`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InvitationsPopup;

