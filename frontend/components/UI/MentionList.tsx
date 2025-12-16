import React from 'react';
import Avatar from '@/components/UI/Avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

interface MentionUser {
    id: string;
    username: string;
    display_name?: string;
    profile_picture?: string;
    is_guest?: boolean; // For anonymous
    role?: string; // For Admin/Owner tags
    is_owner?: boolean;
    is_moderator?: boolean;
}

interface MentionListProps {
    users: MentionUser[];
    selectedIndex: number;
    onSelect: (username: string) => void;
    isLoading?: boolean;
}

const MentionList: React.FC<MentionListProps> = ({ users, selectedIndex, onSelect, isLoading }) => {
    const { t } = useLanguage();
    const { user: currentUser } = useAuth();

    if (isLoading) {
        return (
            <div className="absolute bottom-full left-0 mb-2 w-64 theme-bg-secondary rounded-lg shadow-xl overflow-hidden z-50 p-2 text-center text-sm theme-text-muted border theme-border">
                {t('common.loading') || 'Loading...'}
            </div>
        );
    }

    if (users.length === 0) {
        return null;
    }

    // Helper to get tag config
    const getTag = (user: MentionUser) => {
        // Priority: You > Owner > Moderator > Admin > Anonymous > Bot (if any)
        if (currentUser && user.id === currentUser.id) {
            return { label: t('chat.tagYou') || 'You', color: 'bg-blue-600 text-white' };
        }
        if (user.username === 'todos' || user.username === 'everyone') {
            return { label: t('chat.tagEveryone') || 'Everyone', color: 'bg-yellow-600 text-white' };
        }
        if (user.is_owner) {
            return { label: t('chat.tagOwner') || 'Owner', color: 'bg-amber-500 text-white' };
        }
        if (user.is_moderator) {
            return { label: t('chat.tagModerator') || 'Moderator', color: 'bg-purple-600 text-white' };
        }
        if (user.role === 'admin') {
            return { label: t('chat.tagAdmin') || 'Admin', color: 'bg-red-500 text-white' };
        }
        if (user.is_guest || user.username.startsWith('Anonymous')) {
            return { label: t('chat.tagAnonymous') || 'Anonymous', color: 'bg-gray-500 text-white' };
        }
        return null;
    };

    return (
        <div className="absolute bottom-full left-0 mb-2 w-72 theme-bg-secondary rounded-lg shadow-dark-xl overflow-hidden z-50 flex flex-col border theme-border max-h-60 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-bold theme-text-muted uppercase tracking-wider bg-black/10 dark:bg-black/20">
                {t('chat.members') || 'Members'}
            </div>
            {users.map((user, index) => {
                const tag = getTag(user);
                const isSelected = index === selectedIndex;

                return (
                    <button
                        key={user.id}
                        onClick={() => onSelect(user.username)}
                        className={`w-full flex items-center px-3 py-2 text-left transition-colors ${isSelected
                            ? 'theme-bg-tertiary bg-opacity-100'
                            : 'hover:theme-bg-tertiary bg-opacity-50'
                            }`}
                    >
                        <div className="mr-3 flex-shrink-0">
                            {user.username === 'todos' || user.username === 'everyone' ? (
                                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white">
                                    <span className="text-lg">@</span>
                                </div>
                            ) : (
                                <Avatar
                                    userId={user.username.startsWith('Anonymous') ? undefined : user.id}
                                    username={user.username}
                                    profilePicture={user.profile_picture}
                                    size="md"
                                    className="w-8 h-8"
                                />
                            )}
                        </div>

                        <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className={`text-sm font-medium truncate ${isSelected ? 'theme-text-primary' : 'theme-text-secondary'}`}>
                                    {user.display_name || user.username}
                                </span>
                                <span className="text-xs theme-text-muted truncate">
                                    @{user.username}
                                </span>
                            </div>

                            {tag && (
                                <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${tag.color}`}>
                                    {tag.label}
                                </span>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default MentionList;
