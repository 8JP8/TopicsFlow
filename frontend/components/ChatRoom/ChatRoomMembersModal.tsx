import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import InviteUserPanel from './InviteUserPanel';
import Avatar from '@/components/UI/Avatar';

// Chatroom Photo Section Component
interface ChatRoomPhotoSectionProps {
  roomId: string;
  onPhotoUpdated?: () => void;
}

// Chatroom Background Section Component
interface ChatRoomBackgroundSectionProps {
  roomId: string;
  onPhotoUpdated?: () => void;
}

const ChatRoomPhotoSection: React.FC<ChatRoomPhotoSectionProps> = ({
  roomId,
  onPhotoUpdated,
}) => {
  const { t } = useLanguage();
  const [photo, setPhoto] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current photo
  useEffect(() => {
    const loadCurrentPhoto = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET(roomId));
        if (response.data.success && response.data.data?.picture) {
          setCurrentPhoto(response.data.data.picture);
          setPreview(response.data.data.picture);
        }
      } catch (error) {
        console.error('Failed to load chatroom photo:', error);
      }
    };
    if (roomId) {
      loadCurrentPhoto();
    }
  }, [roomId]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('toast.pleaseSelectImageFile') || 'Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('toast.imageMustBeLessThan10MB') || 'Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPhoto(base64String);
      setPreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!photo) return;

    setUploading(true);
    try {
      console.log('Uploading chatroom photo to:', API_ENDPOINTS.CHAT_ROOMS.UPDATE_BACKGROUND(roomId));
      console.log('Photo data length:', photo.length);

      const response = await api.put(API_ENDPOINTS.CHAT_ROOMS.UPDATE_PICTURE(roomId), {
        picture: photo,
      });

      console.log('Upload response:', response.data);

      if (response.data.success) {
        toast.success(t('chat.photoUpdated') || 'Chatroom photo updated');
        setCurrentPhoto(photo);
        setPhoto(null);
        onPhotoUpdated?.();
      } else {
        const errorMsg = response.data.errors?.[0] || response.data.message || response.data.error || t('toast.failedToUpdatePhoto') || 'Failed to update photo';
        console.error('Upload failed:', response.data);
        toast.error(errorMsg);
      }
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const axiosError = error as { response?: { data?: { errors?: string[]; message?: string; error?: string }; status?: number }; message?: string };
      let errorMessage = t('toast.failedToUpdatePhoto') || 'Failed to update photo';

      if (axiosError.response?.data) {
        errorMessage = axiosError.response.data.errors?.[0] ||
          axiosError.response.data.message ||
          axiosError.response.data.error ||
          errorMessage;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }

      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploading(true);
    try {
      console.log('Removing chatroom photo from:', API_ENDPOINTS.CHAT_ROOMS.UPDATE_BACKGROUND(roomId));

      const response = await api.put(API_ENDPOINTS.CHAT_ROOMS.UPDATE_PICTURE(roomId), {
        picture: null,
      });

      console.log('Remove response:', response.data);

      if (response.data.success) {
        toast.success(t('chat.photoRemoved') || 'Chatroom photo removed');
        setPhoto(null);
        setPreview(null);
        setCurrentPhoto(null);
        onPhotoUpdated?.();
      } else {
        const errorMsg = response.data.errors?.[0] || response.data.message || response.data.error || t('toast.failedToRemovePhoto') || 'Failed to remove photo';
        console.error('Remove failed:', response.data);
        toast.error(errorMsg);
      }
    } catch (error: unknown) {
      console.error('Remove error:', error);
      const axiosError = error as { response?: { data?: { errors?: string[]; message?: string; error?: string }; status?: number }; message?: string };
      let errorMessage = t('toast.failedToRemovePhoto') || 'Failed to remove photo';

      if (axiosError.response?.data) {
        errorMessage = axiosError.response.data.errors?.[0] ||
          axiosError.response.data.message ||
          axiosError.response.data.error ||
          errorMessage;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }

      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPhoto(null);
    setPreview(currentPhoto);
  };

  return (
    <div className="mb-6 p-4 theme-bg-tertiary rounded-lg">
      <h4 className="text-sm font-medium theme-text-primary mb-3">
        {t('chat.chatroomPhoto') || 'Chatroom Photo'}
      </h4>
      <div className="flex items-center space-x-4">
        <div className="relative">
          {preview ? (
            <img
              src={preview.startsWith('data:') ? preview : `data:image/jpeg;base64,${preview}`}
              alt="Chatroom"
              className="w-20 h-20 rounded-lg object-cover border-2 theme-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg theme-bg-secondary border-2 theme-border flex items-center justify-center">
              <svg className="w-8 h-8 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
            id="chatroom-photo-input"
          />
          <div className="flex space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-sm btn btn-secondary"
              disabled={uploading}
            >
              {preview ? (t('chat.changePhoto') || 'Change Photo') : (t('chat.selectPhoto') || 'Select Photo')}
            </button>
            {preview && (
              <>
                {photo && photo !== currentPhoto && (
                  <button
                    onClick={handleSavePhoto}
                    className="px-3 py-1.5 text-sm btn btn-primary"
                    disabled={uploading}
                  >
                    {uploading ? <LoadingSpinner size="sm" /> : (t('common.save') || 'Save')}
                  </button>
                )}
                {photo && photo !== currentPhoto && (
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-sm btn btn-ghost"
                    disabled={uploading}
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                )}
                {currentPhoto && (
                  <button
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                    disabled={uploading}
                  >
                    {t('common.delete') || 'Delete'}
                  </button>
                )}
              </>
            )}
          </div>
          <p className="text-xs theme-text-muted">
            {t('chat.photoHint') || 'Upload a photo for this chatroom (max 2MB)'}
          </p>
        </div>
      </div>
    </div>
  );
};

const ChatRoomBackgroundSection: React.FC<ChatRoomBackgroundSectionProps> = ({
  roomId,
  onPhotoUpdated,
}) => {
  const { t } = useLanguage();
  const [background, setBackground] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentBackground, setCurrentBackground] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadCurrentBackground = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET(roomId));
        if (response.data.success && response.data.data?.background_picture) {
          setCurrentBackground(response.data.data.background_picture);
          setPreview(response.data.data.background_picture);
        }
      } catch (error) {
        console.error('Failed to load chatroom background:', error);
      }
    };
    if (roomId) {
      loadCurrentBackground();
    }
  }, [roomId]);

  const handleBackgroundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('toast.pleaseSelectImageFile') || 'Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('toast.imageMustBeLessThan10MB') || 'Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setBackground(base64String);
      setPreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBackground = async () => {
    if (!background) return;

    setUploading(true);
    try {
      const response = await api.put(API_ENDPOINTS.CHAT_ROOMS.UPDATE_BACKGROUND(roomId), {
        background_picture: background,
      });

      if (response.data.success) {
        toast.success(t('chat.backgroundUpdated') || 'Chatroom background updated');
        setCurrentBackground(background);
        setBackground(null);
        onPhotoUpdated?.();
      } else {
        toast.error(response.data.errors?.[0] || t('toast.failedToUpdateBackground') || 'Failed to update background');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('toast.failedToUpdateBackground') || 'Failed to update background');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    setUploading(true);
    try {
      const response = await api.put(API_ENDPOINTS.CHAT_ROOMS.UPDATE_BACKGROUND(roomId), {
        background_picture: null,
      });

      if (response.data.success) {
        toast.success(t('chat.backgroundRemoved') || 'Chatroom background removed');
        setBackground(null);
        setPreview(null);
        setCurrentBackground(null);
        onPhotoUpdated?.();
      } else {
        toast.error(response.data.errors?.[0] || t('toast.failedToRemoveBackground') || 'Failed to remove background');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('toast.failedToRemoveBackground') || 'Failed to remove background');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setBackground(null);
    setPreview(currentBackground);
  };

  return (
    <div className="mb-6 p-4 theme-bg-tertiary rounded-lg">
      <h4 className="text-sm font-medium theme-text-primary mb-3">
        {t('chat.chatroomBackground') || 'Chatroom Background'}
      </h4>
      <div className="flex items-center space-x-4">
        <div className="relative">
          {preview ? (
            <img
              src={preview.startsWith('data:') ? preview : `data:image/jpeg;base64,${preview}`}
              alt="Chatroom Background"
              className="w-20 h-20 rounded-lg object-cover border-2 theme-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg theme-bg-secondary border-2 theme-border flex items-center justify-center">
              <svg className="w-8 h-8 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleBackgroundSelect}
            className="hidden"
            id="chatroom-background-input"
          />
          <div className="flex space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-sm btn btn-secondary"
              disabled={uploading}
            >
              {preview ? (t('chat.changeBackground') || 'Change Background') : (t('chat.selectBackground') || 'Select Background')}
            </button>
            {preview && (
              <>
                {background && background !== currentBackground && (
                  <button
                    onClick={handleSaveBackground}
                    className="px-3 py-1.5 text-sm btn btn-primary"
                    disabled={uploading}
                  >
                    {uploading ? <LoadingSpinner size="sm" /> : (t('common.save') || 'Save')}
                  </button>
                )}
                {background && background !== currentBackground && (
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-sm btn btn-ghost"
                    disabled={uploading}
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                )}
                {currentBackground && (
                  <button
                    onClick={handleRemoveBackground}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                    disabled={uploading}
                  >
                    {t('common.delete') || 'Delete'}
                  </button>
                )}
              </>
            )}
          </div>
          <p className="text-xs theme-text-muted">
            {t('chat.backgroundHint') || 'Upload a background image for this chatroom (max 10MB)'}
          </p>
        </div>
      </div>
    </div>
  );
};

interface Member {
  id: string;
  username: string;
  is_moderator?: boolean;
  is_owner?: boolean;
}

interface ChatRoomMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  ownerId: string;
  isOwner: boolean;
  isPublic?: boolean; // Whether the chat room is public
  onMemberUpdate?: () => void;
  mode?: 'view' | 'manage'; // 'view' for member count click, 'manage' for manage button
}

const ChatRoomMembersModal: React.FC<ChatRoomMembersModalProps> = ({
  isOpen,
  onClose,
  roomId,
  ownerId,
  isOwner,
  isPublic = false,
  onMemberUpdate,
  mode = 'view',
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string, username: string, email: string }>>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && roomId) {
      loadMembers();
      setInviteUsername('');
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, roomId]);

  // Handle user search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        handleUserSearch();
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      // Get all members from the chat room
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(roomId));
      if (response.data.success && response.data.data) {
        // Get room details to check moderators
        const roomResponse = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET(roomId));
        const roomData = roomResponse.data.data;
        const moderators = roomData?.moderators || [];

        // Convert moderators to strings if they're ObjectIds
        const moderatorIds = moderators.map((m: any) => typeof m === 'string' ? m : String(m));

        const membersData = (response.data.data || []).map((member: any) => ({
          id: member.id || String(member._id || member.user_id),
          username: member.username || 'Unknown',
          is_moderator: moderatorIds.includes(member.id || String(member._id || member.user_id)),
          is_owner: (member.id || String(member._id || member.user_id)) === ownerId,
        }));
        setMembers(membersData);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error('Failed to load members:', error);
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToLoadMembers') || 'Failed to load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
        params: {
          q: searchQuery.trim(),
          limit: 10,
        },
      });

      if (response.data.success) {
        // Filter out users that are already members
        const memberIds = new Set(members.map(m => m.id));
        const filteredResults = (response.data.data || []).filter(
          (userResult: any) => !memberIds.has(userResult.id) && userResult.id !== user?.id
        );
        setSearchResults(filteredResults);
      }
    } catch (error: any) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInviteUser = async (userId?: string, username?: string) => {
    const targetUserId = userId || inviteUsername.trim();
    const targetUsername = username || inviteUsername.trim();

    if (!targetUserId && !targetUsername) {
      toast.error(t('chat.usernameRequired') || 'Username is required');
      return;
    }

    try {
      setInviting(true);
      let finalUserId = targetUserId;

      // If we have username but not ID, get user by username
      if (!finalUserId && targetUsername) {
        const userResponse = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(targetUsername));
        if (!userResponse.data.success || !userResponse.data.data) {
          toast.error(t('chat.userNotFound') || 'User not found');
          return;
        }
        finalUserId = userResponse.data.data.id;
      }

      if (!finalUserId) {
        toast.error(t('chat.userNotFound') || 'User not found');
        return;
      }

      // Check if user is already a member
      if (members.some(m => m.id === finalUserId)) {
        toast.error(t('chat.userAlreadyMember') || 'User is already a member');
        return;
      }

      // Join the user to the chat room (this is the invite action)
      // Note: The backend should handle adding the user to the room
      // We might need a specific invite endpoint, but for now using JOIN
      const joinResponse = await api.post(API_ENDPOINTS.CHAT_ROOMS.JOIN(roomId));
      if (joinResponse.data.success) {
        toast.success(t('chat.userInvited') || 'User invited successfully');
        setInviteUsername('');
        setSearchQuery('');
        setSearchResults([]);
        await loadMembers();
        if (onMemberUpdate) {
          onMemberUpdate();
        }
      } else {
        toast.error(joinResponse.data.errors?.[0] || t('chat.failedToInvite') || 'Failed to invite user');
      }
    } catch (error: any) {
      console.error('Failed to invite user:', error);
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToInvite') || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const handlePromoteToModerator = async (memberId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.ADD_MODERATOR(roomId), {
        user_id: memberId,
      });
      if (response.data.success) {
        toast.success(t('chat.moderatorPromoted') || 'User promoted to moderator');
        await loadMembers();
        if (onMemberUpdate) {
          onMemberUpdate();
        }
      } else {
        toast.error(response.data.errors?.[0] || t('chat.failedToPromote') || 'Failed to promote user');
      }
    } catch (error: any) {
      console.error('Failed to promote user:', error);
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToPromote') || 'Failed to promote user');
    }
  };

  const handleRemoveModerator = async (memberId: string) => {
    try {
      const response = await api.delete(API_ENDPOINTS.CHAT_ROOMS.REMOVE_MODERATOR(roomId, memberId));
      if (response.data.success) {
        toast.success(t('chat.moderatorRemoved') || 'Moderator removed');
        await loadMembers();
        if (onMemberUpdate) {
          onMemberUpdate();
        }
      } else {
        toast.error(response.data.errors?.[0] || t('chat.failedToRemoveModerator') || 'Failed to remove moderator');
      }
    } catch (error: any) {
      console.error('Failed to remove moderator:', error);
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToRemoveModerator') || 'Failed to remove moderator');
    }
  };

  const handleKickUser = async (memberId: string) => {
    if (!confirm(t('chat.confirmKick') || 'Are you sure you want to kick this user?')) {
      return;
    }

    try {
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.KICK_USER(roomId, memberId));
      if (response.data.success) {
        toast.success(t('chat.userKicked') || 'User kicked successfully');
        await loadMembers();
        if (onMemberUpdate) {
          onMemberUpdate();
        }
      } else {
        toast.error(response.data.errors?.[0] || t('chat.failedToKick') || 'Failed to kick user');
      }
    } catch (error: any) {
      console.error('Failed to kick user:', error);
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToKick') || 'Failed to kick user');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b theme-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold theme-text-primary">
              {mode === 'manage'
                ? (t('chatRooms.manageMembers') || 'Manage Members')
                : (t('chatRooms.memberList') || 'Member List')
              }
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-5 h-5 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Chatroom Photo Section (Owner/Moderator only, manage mode only) */}
              {((isOwner || (user && members.some(m => m.id === user.id && m.is_moderator))) && mode === 'manage') && (
                <>
                  <ChatRoomPhotoSection
                    roomId={roomId}
                    onPhotoUpdated={() => {
                      onMemberUpdate?.();
                    }}
                  />
                  <ChatRoomBackgroundSection
                    roomId={roomId}
                    onPhotoUpdated={() => {
                      onMemberUpdate?.();
                    }}
                  />
                </>
              )}

              {/* Invite User Section (Owner only, manage mode only, private chats only) */}
              {isOwner && mode === 'manage' && !isPublic && (
                <div className="mb-6">
                  <InviteUserPanel
                    roomId={roomId}
                    isOwner={isOwner}
                    ownerId={ownerId}
                    moderators={members.filter(m => m.is_moderator).map(m => m.id)}
                    onInviteSent={() => {
                      loadMembers();
                      onMemberUpdate?.();
                    }}
                    onMemberUpdate={() => {
                      loadMembers();
                      onMemberUpdate?.();
                    }}
                  />
                </div>
              )}

              {/* Delete Chatroom Button (Owner only, manage mode only) - Added per user request */}
              {isOwner && mode === 'manage' && (
                <div className="mb-6 p-4 border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-900/10">
                  <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                    {t('chat.dangerZone') || 'Danger Zone'}
                  </h4>
                  <p className="text-xs text-red-600 dark:text-red-300 mb-3">
                    {t('chat.deleteChatroomWarning') || 'Deleting this chatroom is permanent and cannot be undone.'}
                  </p>
                  <button
                    onClick={async () => {
                      if (!confirm(t('chat.confirmDeleteChatroom') || 'Are you sure you want to delete this chatroom?')) {
                        return;
                      }

                      try {
                        const response = await api.delete(API_ENDPOINTS.CHAT_ROOMS.DELETE(roomId));
                        if (response.data.success) {
                          toast.success(t('chat.deletionRequested') || 'Chatroom deletion requested');
                          window.location.reload(); // Refresh to update list
                          onClose();
                        } else {
                          toast.error(response.data.errors?.[0] || t('errors.generic'));
                        }
                      } catch (error: any) {
                        toast.error(error.response?.data?.errors?.[0] || t('errors.generic'));
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors w-full sm:w-auto"
                  >
                    {t('chat.deleteChatroom') || 'Delete Chatroom'}
                  </button>
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium theme-text-primary mb-3">
                  {t('chat.members')} ({members.length})
                </h4>
                {members.length === 0 ? (
                  <p className="text-sm theme-text-muted text-center py-4">
                    {t('chat.noMembers') || 'No members found'}
                  </p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          userId={member.id}
                          username={member.username}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium theme-text-primary">{member.username}</span>
                            {member.is_owner && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded">
                                {t('chat.owner') || 'Owner'}
                              </span>
                            )}
                            {member.is_moderator && !member.is_owner && (
                              <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                                {t('chat.moderator') || 'Moderator'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isOwner && member.id !== user?.id && (
                        <div className="flex items-center gap-2">
                          {!member.is_moderator && (
                            <button
                              onClick={() => handlePromoteToModerator(member.id)}
                              className="px-3 py-1 text-xs btn btn-secondary"
                              title={t('chat.promoteToModerator') || 'Promote to Moderator'}
                            >
                              {t('chat.promote') || 'Promote'}
                            </button>
                          )}
                          {member.is_moderator && (
                            <button
                              onClick={() => handleRemoveModerator(member.id)}
                              className="px-3 py-1 text-xs btn btn-secondary"
                              title={t('chat.removeModerator') || 'Remove Moderator'}
                            >
                              {t('chat.demote') || 'Demote'}
                            </button>
                          )}
                          <button
                            onClick={() => handleKickUser(member.id)}
                            className="px-3 py-1 text-xs btn btn-danger"
                            title={t('chat.kickUser') || 'Kick User'}
                          >
                            {t('chat.kick') || 'Kick'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatRoomMembersModal;

