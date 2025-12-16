import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from './LoadingSpinner';
import useEscapeKey from '@/hooks/useEscapeKey';
import toast from 'react-hot-toast';

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
  useEscapeKey(() => {
    if (isOpen) onClose();
  });
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Friend search state
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchQueryUsername, setSearchQueryUsername] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

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

  const handleSearchUsers = async () => {
    if (!searchQueryUsername.trim() || searchQueryUsername.length < 2) {
      return;
    }

    setSearching(true);

    try {
      const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
        q: searchQueryUsername,
        limit: 20,
      });

      if (response.data.success) {
        setSearchResults(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (userId: string, username: string) => {
    try {
      // Check if trying to send to yourself
      if (user && userId === user.id) {
        toast.error(t('privateMessages.cannotSendFriendRequestToYourself'));
        return;
      }

      const response = await api.post(API_ENDPOINTS.USERS.SEND_FRIEND_REQUEST, {
        to_user_id: userId,
      });

      if (response.data.success) {
        toast.success(t('privateMessages.friendRequestSent') || `Friend request sent to ${username}`);
        // Reload friends list and reset search
        await loadFriends();
        setShowAddFriend(false);
        setSearchQueryUsername('');
        setSearchResults([]);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || error.response?.data?.error || '';
      let translatedError = errorMessage;

      if (errorMessage.includes('Cannot send friend request to yourself')) {
        translatedError = t('privateMessages.cannotSendFriendRequestToYourself');
      } else if (errorMessage.includes('Already friends')) {
        translatedError = t('privateMessages.alreadyFriends');
      } else if (errorMessage.toLowerCase().includes('already sent') || errorMessage.toLowerCase().includes('already pending')) {
        translatedError = t('privateMessages.friendRequestAlreadyPending');
      } else if (!errorMessage) {
        translatedError = t('privateMessages.failedToSendRequest');
      }

      toast.error(translatedError);
    }
  };

  // Trigger search on input change with debouncing
  useEffect(() => {
    if (showAddFriend && searchQueryUsername.trim().length >= 2) {
      const timer = setTimeout(() => {
        handleSearchUsers();
      }, 300);
      return () => clearTimeout(timer);
    } else if (showAddFriend && searchQueryUsername.trim().length === 0) {
      setSearchResults([]);
    }
  }, [searchQueryUsername, showAddFriend]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col"
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

        {/* Search Box or Back Button */}
        {!showAddFriend ? (
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
        ) : (
          <div className="p-4 border-b theme-border">
            <button
              onClick={() => {
                setShowAddFriend(false);
                setSearchQueryUsername('');
                setSearchResults([]);
              }}
              className="flex items-center gap-2 theme-text-primary hover:theme-text-secondary transition-colors mb-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('common.back')}
            </button>
            <input
              type="text"
              value={searchQueryUsername}
              onChange={(e) => setSearchQueryUsername(e.target.value)}
              placeholder={t('privateMessages.searchByUsername') || 'Search by username...'}
              className="w-full px-4 py-2 theme-bg-tertiary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted"
              autoFocus
            />
          </div>
        )}

        {/* Friends List or Search Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {!showAddFriend ? (
            // Friends List View
            loading ? (
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
            )
          ) : (
            // User Search View
            searching ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full theme-blue-primary flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium theme-text-primary">{user.username}</h4>
                        <p className="text-xs theme-text-secondary">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendFriendRequest(user.id, user.username)}
                      className="px-3 py-1 btn btn-primary text-sm"
                    >
                      {t('privateMessages.addFriend')}
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQueryUsername.trim().length > 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="theme-text-secondary text-sm">
                  {t('privateMessages.noUsersFound') || 'No users found'}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 theme-text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="theme-text-secondary text-sm">
                  {t('common.startTyping') || 'Start typing to search...'}
                </p>
              </div>
            )
          )}
        </div>

        {/* Footer with Add Friend Button */}
        {!showAddFriend && (
          <div className="p-4 border-t theme-border">
            <button
              onClick={() => setShowAddFriend(true)}
              className="w-full px-4 py-2 btn btn-primary flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {t('privateMessages.addFriend')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsDialog;

