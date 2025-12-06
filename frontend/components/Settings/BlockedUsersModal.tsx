import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '../UI/LoadingSpinner';
import toast from 'react-hot-toast';
import ReportUserDialog from '../Reports/ReportUserDialog';
import Avatar from '../UI/Avatar';

interface BlockedUser {
  id: string;
  username: string;
}

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BlockedUsersModal: React.FC<BlockedUsersModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [userToReport, setUserToReport] = useState<{userId: string, username: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBlockedUsers();
    }
  }, [isOpen]);

  const loadBlockedUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.BLOCKING.LIST_BLOCKED);
      if (response.data.success) {
        const users = response.data.data || [];
        // Ensure we have the correct data structure
        setBlockedUsers(users.map((user: any) => ({
          id: user.id || user._id,
          username: user.username || 'Unknown'
        })));
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic') || 'Failed to load blocked users');
      }
    } catch (error: any) {
      console.error('Failed to load blocked users:', error);
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic') || 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      const response = await api.delete(API_ENDPOINTS.BLOCKING.UNBLOCK(userId));
      if (response.data.success) {
        toast.success(t('blocking.userUnblocked') || 'User unblocked');
        loadBlockedUsers();
      } else {
        toast.error(response.data.errors?.[0] || t('errors.generic') || 'Failed to unblock user');
      }
    } catch (error: any) {
      console.error('Failed to unblock user:', error);
      toast.error(error.response?.data?.errors?.[0] || t('errors.generic') || 'Failed to unblock user');
    }
  };

  const handleReportUser = (userId: string, username: string) => {
    setUserToReport({ userId, username });
    setShowReportDialog(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold theme-text-primary">{t('settings.blockedUsers') || 'Blocked Users'}</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm theme-text-secondary mt-2">{t('settings.blockedUsersDesc') || 'Manage users you have blocked'}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="theme-text-secondary">{t('blocking.noBlockedUsers') || 'No blocked users'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedUsers.map(blockedUser => (
                  <div
                    key={blockedUser.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar
                        userId={blockedUser.id}
                        username={blockedUser.username}
                        size="md"
                      />
                      <span className="font-medium theme-text-primary">{blockedUser.username}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleReportUser(blockedUser.id, blockedUser.username)}
                        className="px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-medium"
                      >
                        {t('contextMenu.report') || 'Report'}
                      </button>
                      <button
                        onClick={() => handleUnblockUser(blockedUser.id)}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        {t('blocking.unblockUser') || 'Unblock'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showReportDialog && userToReport && (
        <ReportUserDialog
          userId={userToReport.userId}
          username={userToReport.username}
          onClose={() => {
            setShowReportDialog(false);
            setUserToReport(null);
          }}
          includeMessageHistory={true}
        />
      )}
    </>
  );
};

export default BlockedUsersModal;

