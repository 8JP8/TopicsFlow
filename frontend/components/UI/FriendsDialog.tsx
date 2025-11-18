import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from './LoadingSpinner';

interface Friend {
  id: string;
  username: string;
  email: string;
  profile_picture?: string;
}

interface FriendsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFriend: (friendId: string, username: string) => void;
}

const FriendsDialog: React.FC<FriendsDialogProps> = ({ isOpen, onClose, onSelectFriend }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadFriends();
    }
  }, [isOpen, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.USERS.FRIENDS);
      if (response.data.success) {
        setFriends(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        className="theme-bg-secondary rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b theme-border">
          <h3 className="text-lg font-semibold theme-text-primary">{t('privateMessages.friends')}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
          >
            <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Box */}
        <div className="p-4 border-b theme-border">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('privateMessages.searchFriends')}
            className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
            autoFocus
          />
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : filteredFriends.length > 0 ? (
            <div className="space-y-2">
              {filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full theme-blue-primary flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {friend.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium theme-text-primary">{friend.username}</h4>
                      <p className="text-xs theme-text-secondary">{friend.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSelectFriend(friend.id, friend.username);
                      onClose();
                    }}
                    className="px-3 py-1 btn btn-primary text-sm"
                  >
                    {t('privateMessages.message')}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="theme-text-secondary text-sm">
                {searchQuery ? t('privateMessages.noFriendsFound') : t('privateMessages.noFriends')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsDialog;

