import React, { useState, useEffect, useRef } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import Avatar from '@/components/UI/Avatar';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface InviteUserPanelProps {
  roomId: string;
  onInviteSent?: () => void;
  isOwner?: boolean;
  ownerId?: string;
  moderators?: string[];
  onMemberUpdate?: () => void;
}

const InviteUserPanel: React.FC<InviteUserPanelProps> = ({ 
  roomId, 
  onInviteSent, 
  isOwner = false,
  ownerId,
  moderators = [],
  onMemberUpdate
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{id: string, username: string, profile_picture?: string, is_member?: boolean, is_moderator?: boolean}>>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current members to check if user is already a member
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(roomId));
        if (response.data.success && response.data.data) {
          const memberIds = new Set<string>(response.data.data.map((m: any) => String(m.id)));
          setMembers(memberIds);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      }
    };
    fetchMembers();
  }, [roomId]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
        params: { q: query, limit: 10 }
      });

      if (response.data.success) {
        const users = (response.data.data || []).map((user: any) => ({
          ...user,
          is_member: members.has(String(user.id)),
          is_moderator: moderators.includes(String(user.id))
        }));
        setSearchResults(users);
      }
    } catch (error: any) {
      console.error('Failed to search users:', error);
      // Try alternative endpoint
      try {
        const response = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(query));
        if (response.data.success && response.data.data) {
          const user = {
            ...response.data.data,
            is_member: members.has(String(response.data.data.id)),
            is_moderator: moderators.includes(String(response.data.data.id))
          };
          setSearchResults([user]);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (userId: string, username: string) => {
    // Check if user is already a member
    if (members.has(String(userId))) {
      toast.error(t('chatRoom.userAlreadyMember', { username }) || `${username} is already a member of this chat`);
      return;
    }

    try {
      setInviting(userId);
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.INVITE_USER(roomId), {
        user_id: userId
      });

      if (response.data.success) {
        toast.success(t('chatRoom.userInvited', { username }) || `Invited ${username}`);
        setSearchQuery('');
        setSearchResults([]);
        // Refresh members list
        const membersResponse = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(roomId));
        if (membersResponse.data.success && membersResponse.data.data) {
          const memberIds = new Set<string>(membersResponse.data.data.map((m: any) => String(m.id)));
          setMembers(memberIds);
        }
        onInviteSent?.();
      } else {
        const errorMsg = response.data.errors?.[0] || t('chatRoom.failedToInvite') || 'Failed to invite user';
        toast.error(errorMsg);
        console.error('Invite error:', response.data);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.errors?.[0] || t('chatRoom.failedToInvite') || 'Failed to invite user';
      toast.error(errorMsg);
      console.error('Invite error:', error);
    } finally {
      setInviting(null);
    }
  };

  const handlePromote = async (userId: string, username: string) => {
    if (!confirm(t('chat.confirmPromote', { username }) || `Are you sure you want to promote ${username} to moderator?`)) {
      return;
    }

    try {
      setPromoting(userId);
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.ADD_MODERATOR(roomId), {
        user_id: userId
      });

      if (response.data.success) {
        toast.success(t('chat.moderatorPromoted') || 'User promoted to moderator');
        setSearchQuery('');
        setSearchResults([]);
        // Refresh members list
        const membersResponse = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(roomId));
        if (membersResponse.data.success && membersResponse.data.data) {
          const memberIds = new Set<string>(membersResponse.data.data.map((m: any) => String(m.id)));
          setMembers(memberIds);
        }
        onMemberUpdate?.();
        onInviteSent?.();
      } else {
        const errorMsg = response.data.errors?.[0] || t('chat.failedToPromote') || 'Failed to promote user';
        toast.error(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.errors?.[0] || t('chat.failedToPromote') || 'Failed to promote user';
      toast.error(errorMsg);
    } finally {
      setPromoting(null);
    }
  };

  const handleDemote = async (userId: string, username: string) => {
    if (!confirm(t('chat.confirmDemote', { username }) || `Are you sure you want to remove ${username} as moderator?`)) {
      return;
    }

    try {
      setPromoting(userId);
      const response = await api.delete(API_ENDPOINTS.CHAT_ROOMS.REMOVE_MODERATOR(roomId, userId));

      if (response.data.success) {
        toast.success(t('chat.moderatorRemoved') || 'Moderator removed');
        setSearchQuery('');
        setSearchResults([]);
        // Refresh members list
        const membersResponse = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(roomId));
        if (membersResponse.data.success && membersResponse.data.data) {
          const memberIds = new Set<string>(membersResponse.data.data.map((m: any) => String(m.id)));
          setMembers(memberIds);
        }
        onMemberUpdate?.();
        onInviteSent?.();
      } else {
        const errorMsg = response.data.errors?.[0] || t('chat.failedToRemoveModerator') || 'Failed to remove moderator';
        toast.error(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.errors?.[0] || t('chat.failedToRemoveModerator') || 'Failed to remove moderator';
      toast.error(errorMsg);
    } finally {
      setPromoting(null);
    }
  };

  const handleKick = async (userId: string, username: string) => {
    if (!confirm(t('chat.confirmKick', { username }) || `Are you sure you want to kick ${username}?`)) {
      return;
    }

    try {
      setKicking(userId);
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.KICK_USER(roomId, userId));

      if (response.data.success) {
        toast.success(t('chat.userKicked') || 'User kicked successfully');
        setSearchQuery('');
        setSearchResults([]);
        // Refresh members list
        const membersResponse = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(roomId));
        if (membersResponse.data.success && membersResponse.data.data) {
          const memberIds = new Set<string>(membersResponse.data.data.map((m: any) => String(m.id)));
          setMembers(memberIds);
        }
        onMemberUpdate?.();
        onInviteSent?.();
      } else {
        const errorMsg = response.data.errors?.[0] || t('chat.failedToKick') || 'Failed to kick user';
        toast.error(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.errors?.[0] || t('chat.failedToKick') || 'Failed to kick user';
      toast.error(errorMsg);
    } finally {
      setKicking(null);
    }
  };

  return (
    <div className="p-4 theme-bg-tertiary rounded-lg mb-4">
      <h4 className="text-sm font-medium theme-text-primary mb-3">
        {t('chatRoom.inviteUser') || 'Invite User'}
      </h4>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('chatRoom.searchUsername') || 'Search by username...'}
          className="w-full px-3 py-2 theme-bg-secondary theme-border rounded-lg theme-text-primary placeholder-theme-text-muted text-sm"
        />
        {searching && (
          <div className="absolute right-3 top-2.5">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
          {searchResults.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-2 theme-bg-secondary rounded-lg hover:theme-bg-hover transition-colors"
            >
              <div className="flex items-center space-x-2 flex-1">
                <Avatar
                  userId={user.id}
                  username={user.username}
                  profilePicture={user.profile_picture}
                  size="sm"
                />
                <div className="flex flex-col">
                  <span className="text-sm theme-text-primary">{user.username}</span>
                  {user.is_moderator && (
                    <span className="text-xs theme-text-muted">{t('chat.moderator') || 'Moderator'}</span>
                  )}
                </div>
              </div>
              {user.is_member ? (
                isOwner && user.id !== user?.id && user.id !== ownerId ? (
                  <div className="flex items-center gap-2">
                    {!user.is_moderator ? (
                      <button
                        onClick={() => handlePromote(user.id, user.username)}
                        disabled={promoting === user.id}
                        className="px-3 py-1 text-xs btn btn-secondary disabled:opacity-50"
                        title={t('chat.promoteToModerator') || 'Promote to Moderator'}
                      >
                        {promoting === user.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          t('chat.promote') || 'Promote'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDemote(user.id, user.username)}
                        disabled={promoting === user.id}
                        className="px-3 py-1 text-xs btn btn-secondary disabled:opacity-50"
                        title={t('chat.removeModerator') || 'Remove Moderator'}
                      >
                        {promoting === user.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          t('chat.demote') || 'Demote'
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleKick(user.id, user.username)}
                      disabled={kicking === user.id}
                      className="px-3 py-1 text-xs btn btn-danger disabled:opacity-50"
                      title={t('chat.kickUser') || 'Kick User'}
                    >
                      {kicking === user.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        t('chat.kick') || 'Kick'
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="px-3 py-1 text-xs theme-text-muted">
                    {t('chatRoom.alreadyMember') || 'Already a member'}
                  </span>
                )
              ) : (
                <button
                  onClick={() => handleInvite(user.id, user.username)}
                  disabled={inviting === user.id}
                  className="px-3 py-1 text-xs btn btn-primary disabled:opacity-50"
                >
                  {inviting === user.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    t('chatRoom.invite') || 'Invite'
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {searchQuery && !searching && searchResults.length === 0 && (
        <div className="mt-3 text-sm theme-text-muted text-center py-2">
          {t('chatRoom.noUsersFound') || 'No users found'}
        </div>
      )}
    </div>
  );
};

export default InviteUserPanel;

