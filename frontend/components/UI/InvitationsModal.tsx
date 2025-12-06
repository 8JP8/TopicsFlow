import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import Avatar from './Avatar';

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

interface InvitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvitationHandled?: () => void;
}

const InvitationsModal: React.FC<InvitationsModalProps> = ({
  isOpen,
  onClose,
  onInvitationHandled,
}) => {
  const { t } = useLanguage();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

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
        // Filter to only show pending invitations
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
        // Optionally navigate to the chat room
        // router.push(`/chat-room/${roomId}`);
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="theme-bg-secondary border theme-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
            <h2 className="text-xl font-bold theme-text-primary">
              {t('invitations.title') || 'Chat Invitations'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-lg theme-text-primary mb-2">
                  {t('invitations.noInvitations') || 'No pending invitations'}
                </p>
                <p className="text-sm theme-text-muted">
                  {t('invitations.noInvitationsDesc') || "You don't have any pending chat room invitations."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="relative overflow-hidden rounded-lg border theme-border"
                  >
                    {invitation.background_picture && (
                      <div className="absolute inset-0 opacity-20">
                        <img
                          src={invitation.background_picture}
                          alt={invitation.room_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className={`relative p-4 ${invitation.background_picture ? 'theme-bg-tertiary/90' : 'theme-bg-tertiary'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {invitation.background_picture ? (
                              <img
                                src={invitation.background_picture}
                                alt={invitation.room_name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                                💬
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold theme-text-primary">
                                {invitation.room_name}
                              </h3>
                              {invitation.room_description && (
                                <p className="text-sm theme-text-muted mt-1">
                                  {invitation.room_description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-sm theme-text-muted ml-12">
                            <div className="flex items-center space-x-2">
                              <Avatar
                                userId={invitation.invited_by.id}
                                username={invitation.invited_by.username}
                                size="sm"
                              />
                              <span>
                                {t('invitations.invitedBy') || 'Invited by'} {invitation.invited_by.username}
                              </span>
                            </div>
                            <span>•</span>
                            <span>{formatDate(invitation.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mt-4">
                        <button
                          onClick={() => handleAccept(invitation.id, invitation.room_id)}
                          disabled={processing === invitation.id}
                          className="flex-1 px-4 py-2 btn btn-primary disabled:opacity-50"
                        >
                          {processing === invitation.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            t('invitations.accept') || 'Accept'
                          )}
                        </button>
                        <button
                          onClick={() => handleDecline(invitation.id)}
                          disabled={processing === invitation.id}
                          className="flex-1 px-4 py-2 btn btn-secondary disabled:opacity-50"
                        >
                          {processing === invitation.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            t('invitations.decline') || 'Decline'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InvitationsModal;

