import React, { useState, useEffect, useRef } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '../UI/LoadingSpinner';
import Avatar from '../UI/Avatar';

interface UserResult {
    id: string;
    username: string;
    email: string;
    profile_picture?: string;
}

interface GroupChatCreateModalProps {
    onClose: () => void;
    onGroupCreated: (chat: any) => void;
}

const GroupChatCreateModal: React.FC<GroupChatCreateModalProps> = ({ onClose, onGroupCreated }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        picture: '',
    });
    // Store selected users as full objects so we can display them even if not in search results
    const [selectedUsers, setSelectedUsers] = useState<Map<string, UserResult>>(new Map());

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [picturePreview, setPicturePreview] = useState<string | null>(null);
    const pictureInputRef = useRef<HTMLInputElement>(null);

    // Initial load of friends to populate initial list
    useEffect(() => {
        loadInitialFriends();
    }, []);

    const loadInitialFriends = async () => {
        try {
            setIsSearching(true);
            const response = await api.get(API_ENDPOINTS.USERS.FRIENDS);
            if (response.data.success) {
                setSearchResults(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
        } finally {
            setIsSearching(false);
        }
    };

    // Dynamic Search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.trim().length >= 2) {
            setIsSearching(true);
            searchTimeoutRef.current = setTimeout(async () => {
                try {
                    const response = await api.get(API_ENDPOINTS.USERS.SEARCH, {
                        params: { q: searchQuery.trim(), limit: 10 }
                    });
                    if (response.data.success) {
                        setSearchResults(response.data.data || []);
                    }
                } catch (error) {
                    console.error('Search failed:', error);
                } finally {
                    setIsSearching(false);
                }
            }, 300);
        } else if (searchQuery.trim().length === 0) {
            // Reload friends to show suggestions when search is cleared
            loadInitialFriends();
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const toggleUser = (user: UserResult) => {
        setSelectedUsers(prev => {
            const newMap = new Map(prev);
            if (newMap.has(user.id)) {
                newMap.delete(user.id);
            } else {
                newMap.set(user.id, user);
            }
            return newMap;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors([]);

        if (!formData.name.trim()) {
            setErrors([t('chats.nameRequired') || 'Group name is required']);
            return;
        }

        if (formData.name.length > 100) {
            setErrors([t('chats.nameTooLong') || 'Name must be 100 characters or less']);
            return;
        }

        setLoading(true);

        try {
            const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.CREATE_GROUP, {
                name: formData.name.trim(),
                description: formData.description.trim(),
                invited_users: Array.from(selectedUsers.keys()), // Send IDs
                picture: formData.picture,
            });

            if (response.data.success) {
                toast.success(t('chats.groupCreated') || 'Group chat created successfully');
                onGroupCreated(response.data.data);
                onClose();
            } else {
                setErrors(response.data.errors || ['Failed to create group chat']);
            }
        } catch (error: any) {
            console.error('Failed to create group chat:', error);
            const errorMessage = error.response?.data?.errors?.[0] || 'Failed to create group chat';
            setErrors([errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b theme-border">
                    <h3 className="text-lg font-semibold theme-text-primary">
                        {t('chats.createGroup') || 'Create Group Chat'}
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

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {errors.length > 0 && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                            <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                                {errors.map((error, index) => (
                                    <li key={index}>• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <form id="create-group-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Picture Upload */}
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full border-2 theme-border overflow-hidden bg-gray-100 dark:bg-gray-700">
                                    {picturePreview ? (
                                        <img src={picturePreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => pictureInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 bg-blue-500 text-white p-1.5 rounded-full hover:bg-blue-600 shadow-md"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                <input
                                    ref={pictureInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (file.size > 100 * 1024 * 1024) {
                                                toast.error(t('toast.imageMustBeLessThan100MB') || 'Image must be less than 100MB');
                                                return;
                                            }
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                setPicturePreview(reader.result as string);
                                                setFormData(prev => ({ ...prev, picture: reader.result as string }));
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="name" className="block text-sm font-medium theme-text-primary mb-1">
                                {t('chats.groupName') || 'Group Name'} *
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                maxLength={100}
                                required
                                className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={t('chats.groupNamePlaceholder') || 'Enter group name...'}
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium theme-text-primary mb-1">
                                {t('chats.description') || 'Description'}
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                maxLength={500}
                                rows={3}
                                className="w-full px-3 py-2 border theme-border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder={t('chats.groupDescriptionPlaceholder') || 'Enter group description...'}
                            />
                        </div>

                        {/* Search & Selection */}
                        <div>
                            <label className="block text-sm font-medium theme-text-primary mb-2">
                                {t('chats.addParticipants') || 'Add Participants'}
                            </label>

                            {/* Selected Users Chips */}
                            {selectedUsers.size > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {Array.from(selectedUsers.values()).map(user => (
                                        <div key={user.id} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-full">
                                            <Avatar
                                                userId={user.id}
                                                username={user.username}
                                                profilePicture={user.profile_picture}
                                                size="xs"
                                            />
                                            <span className="text-xs text-blue-800 dark:text-blue-100">{user.username}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleUser(user)}
                                                className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 ml-1"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="border theme-border rounded-lg overflow-hidden">
                                <div className="p-2 border-b theme-border bg-gray-50 dark:bg-gray-900">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t('privateMessages.searchUsers') || 'Search users...'}
                                        className="w-full px-3 py-1.5 text-sm theme-bg-tertiary theme-border rounded theme-text-primary placeholder-theme-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                                    {isSearching ? (
                                        <div className="flex justify-center p-4">
                                            <LoadingSpinner size="sm" />
                                        </div>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleUser(user)}
                                                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selectedUsers.has(user.id)
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                                    : 'hover:theme-bg-tertiary'
                                                    }`}
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-8 h-8 relative">
                                                        <Avatar
                                                            userId={user.id}
                                                            username={user.username}
                                                            profilePicture={user.profile_picture}
                                                            size="md"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium theme-text-primary">{user.username}</div>
                                                    </div>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedUsers.has(user.id)
                                                    ? 'bg-blue-500 border-blue-500 text-white'
                                                    : 'border-gray-300 dark:border-gray-600'
                                                    }`}>
                                                    {selectedUsers.has(user.id) && (
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center p-4 text-xs theme-text-muted">
                                            {searchQuery ? (t('privateMessages.noUsersFound') || 'No users found') : (t('privateMessages.startTypingToSearch') || 'Start typing to search users...')}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="mt-1 text-xs theme-text-muted text-right">
                                {selectedUsers.size} {t('chats.participantsSelected') || 'selected'}
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-4 border-t theme-border flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium theme-text-secondary hover:theme-text-primary transition-colors"
                        disabled={loading}
                    >
                        {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                        type="submit"
                        form="create-group-form"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? <LoadingSpinner size="sm" className="text-white" /> : (t('common.create') || 'Create')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupChatCreateModal;
