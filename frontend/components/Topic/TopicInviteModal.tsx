import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../UI/LoadingSpinner';
import Avatar from '../UI/Avatar';
import useEscapeKey from '@/hooks/useEscapeKey';

interface TopicInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
  topicTitle: string;
  onInviteSent?: () => void;
}

const TopicInviteModal: React.FC<TopicInviteModalProps> = ({
  isOpen,
  onClose,
  topicId,
  topicTitle,
  onInviteSent,
}) => {
  const { t } = useLanguage();
  useEscapeKey(() => {
    if (isOpen) onClose();
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        searchUsers();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setUsers([]);
    }
  }, [searchQuery, isOpen]);

  const searchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
        q: searchQuery,
        limit: 20
      });
      if (response.data.success) {
        setUsers(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Failed to search users:', error);
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic') || 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (userId: string, username: string) => {
    try {
      setInviting(userId);
      const response = await api.post(API_ENDPOINTS.TOPICS.INVITE(topicId), {
        user_id: userId
      });
      if (response.data.success) {
        toast.success(t('topics.userInvited') || `User ${username} invited successfully`);
        setInvitedUsers(prev => new Set([...prev, userId]));
        onInviteSent?.();
      } else {
        toast.error(response.data.errors?.[0] || t('topics.failedToInvite') || 'Failed to invite user');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || t('topics.failedToInvite') || 'Failed to invite user';
      toast.error(errorMessage);
    } finally {
      setInviting(null);
    }
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
          className="bg-white dark:bg-gray-800 border theme-border rounded-lg shadow-xl w-full max-w-2xl mx-4 sm:mx-auto max-h-[85vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
            <div>
              <h2 className="text-xl font-bold theme-text-primary">
                {t('topics.inviteUsers') || 'Invite Users'}
              </h2>
              <p className="text-sm theme-text-muted mt-1">
                {t('topics.inviteUsersToTopic') || `Invite users to join "${topicTitle}"`}
              </p>
            </div>
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
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('topics.searchUsersPlaceholder') || 'Search users by username...'}
                className="w-full px-4 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
              />
            </div>

            {/* Users List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm theme-text-muted">
                  {searchQuery.trim().length < 2
                    ? t('topics.typeToSearch') || 'Type at least 2 characters to search'
                    : t('topics.noUsersFound') || 'No users found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 theme-bg-primary rounded-lg border theme-border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        userId={user.id}
                        username={user.username}
                        size="md"
                      />
                      <div>
                        <p className="font-medium theme-text-primary">{user.username}</p>
                        {user.email && (
                          <p className="text-xs theme-text-muted">{user.email}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleInvite(user.id, user.username)}
                      disabled={inviting === user.id || invitedUsers.has(user.id)}
                      className="px-4 py-2 text-sm btn btn-primary disabled:opacity-50"
                    >
                      {inviting === user.id ? (
                        <LoadingSpinner size="sm" />
                      ) : invitedUsers.has(user.id) ? (
                        t('topics.invited') || 'Invited'
                      ) : (
                        t('topics.invite') || 'Invite'
                      )}
                    </button>
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

export default TopicInviteModal;

