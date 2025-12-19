import React, { useState, useEffect, useRef } from 'react';
import { useVoip } from '@/contexts/VoipContext';
import { useAuth } from '@/contexts/AuthContext';
import UserTooltip from '@/components/UI/UserTooltip';
import Avatar from '@/components/UI/Avatar';
import { api, API_ENDPOINTS } from '@/utils/api';

// Cache for user data to avoid repeated API calls
const userDataCache = new Map<string, { username?: string; profilePicture?: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface VoipParticipantProps {
    participant: {
        user_id: string;
        username?: string;
        profile_picture?: string;
        is_muted: boolean;
        is_disconnected?: boolean;
    };
}

const VoipParticipant: React.FC<VoipParticipantProps> = ({ participant }) => {
    const { speakingUsers } = useVoip();
    const { user } = useAuth();
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [fetchedData, setFetchedData] = useState<{ username?: string; profilePicture?: string }>({});
    const mountedRef = useRef(true);

    const isSpeaking = speakingUsers.has(participant.user_id);
    const isCurrentUser = user?.id === participant.user_id;

    // Debug: log speaking status
    useEffect(() => {
        console.log('[VoipParticipant] Speaking status for', participant.user_id, ':', isSpeaking, 'speakingUsers:', Array.from(speakingUsers));
    }, [isSpeaking, participant.user_id, speakingUsers]);

    // Fetch user data from API if not provided
    useEffect(() => {
        mountedRef.current = true;

        const fetchUserData = async () => {
            // If participant data is already complete, use it
            if (participant.profile_picture && participant.username) {
                setFetchedData({
                    username: participant.username,
                    profilePicture: participant.profile_picture
                });
                return;
            }

            // For current user, use their data from auth context
            if (isCurrentUser && user) {
                setFetchedData({
                    username: user.username,
                    profilePicture: user.profile_picture
                });
                return;
            }

            // Check cache first
            const cacheKey = `user_${participant.user_id}`;
            const cached = userDataCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                if (mountedRef.current) {
                    setFetchedData({
                        username: cached.username || participant.username,
                        profilePicture: cached.profilePicture || participant.profile_picture
                    });
                }
                return;
            }

            // Fetch from API if we have a username
            const username = participant.username || (isCurrentUser ? user?.username : undefined);
            if (!username) return;

            try {
                const response = await api.get(API_ENDPOINTS.USERS.GET_BY_USERNAME(username));
                if (response.data.success && response.data.data && mountedRef.current) {
                    const userData = response.data.data;
                    setFetchedData({
                        username: userData.username,
                        profilePicture: userData.profile_picture
                    });
                    // Cache the result
                    userDataCache.set(cacheKey, {
                        username: userData.username,
                        profilePicture: userData.profile_picture,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error('[VoipParticipant] Failed to fetch user data:', error);
            }
        };

        fetchUserData();

        return () => {
            mountedRef.current = false;
        };
    }, [participant.user_id, participant.username, participant.profile_picture, isCurrentUser, user]);

    // Use fetched data or fallback to participant/user data
    const displayUsername = fetchedData.username || participant.username || (isCurrentUser ? user?.username : undefined) || 'User';
    const displayProfilePicture = fetchedData.profilePicture || participant.profile_picture || (isCurrentUser ? user?.profile_picture : undefined);

    const handleMouseEnter = (e: React.MouseEvent) => {
        setTooltipPosition({ x: e.clientX, y: e.clientY });
        setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    return (
        <div className="relative">
            {/* Speaking indicator ring wrapper */}
            <div
                className={`
                    relative rounded-full cursor-pointer transition-all duration-150 flex-shrink-0
                `}
                style={isSpeaking ? {
                    boxShadow: '0 0 0 3px #22c55e, 0 0 12px 2px rgba(34, 197, 94, 0.6)',
                } : {}}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Use Avatar component for consistent styling with chat */}
                <Avatar
                    userId={participant.user_id}
                    username={displayUsername}
                    profilePicture={displayProfilePicture}
                    size="lg"
                />
            </div>

            {/* Muted Indicator - Outside overflow-hidden so it doesn't clip */}
            {participant.is_muted && !participant.is_disconnected && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10 border-2 border-gray-800">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                    </svg>
                </div>
            )}

            {/* Disconnected Indicator - Blinking network/plug icon */}
            {participant.is_disconnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full z-20">
                    <div className="animate-pulse">
                        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {/* Unplugged/disconnected icon */}
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                        </svg>
                    </div>
                </div>
            )}

            {/* UserTooltip - Always show for all users */}
            {showTooltip && (
                <UserTooltip
                    username={displayUsername}
                    x={tooltipPosition.x}
                    y={tooltipPosition.y}
                    onClose={() => setShowTooltip(false)}
                />
            )}
        </div>
    );
};

export default VoipParticipant;
