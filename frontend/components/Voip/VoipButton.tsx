import React, { useState, useEffect } from 'react';
import { useVoip } from '@/contexts/VoipContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface VoipButtonProps {
    roomId: string;
    roomType: 'group' | 'dm';
    roomName?: string;
    className?: string;
    variant?: 'default' | 'bordered';
    disabled?: boolean;
}

const VoipButton: React.FC<VoipButtonProps> = ({ roomId, roomType, roomName, className = '', variant = 'default', disabled = false }) => {
    const { activeCall, createCall, joinCall, leaveCall, connectionStatus, checkActiveCall } = useVoip();
    const { t } = useLanguage();
    const [roomActiveCall, setRoomActiveCall] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Check for active call when component mounts or roomId changes
    useEffect(() => {
        if (disabled) return;

        checkActiveCall(roomId);

        const handleActiveCall = (event: CustomEvent) => {
            if (event.detail.room_id === roomId) {
                setRoomActiveCall(event.detail.call);
            }
        };

        const handleCallStarted = (event: CustomEvent) => {
            if (event.detail.call?.room_id === roomId) {
                setRoomActiveCall(event.detail.call);
            }
        };

        const handleCallEnded = (event: CustomEvent) => {
            // Clear roomActiveCall when any call ends for this room
            if (event.detail.room_id === roomId || event.detail.call?.room_id === roomId) {
                setRoomActiveCall(null);
            }
        };

        window.addEventListener('voip_active_call', handleActiveCall as EventListener);
        window.addEventListener('voip_call_started', handleCallStarted as EventListener);
        window.addEventListener('voip_call_ended', handleCallEnded as EventListener);

        return () => {
            window.removeEventListener('voip_active_call', handleActiveCall as EventListener);
            window.removeEventListener('voip_call_started', handleCallStarted as EventListener);
            window.removeEventListener('voip_call_ended', handleCallEnded as EventListener);
        };
    }, [roomId, checkActiveCall, disabled]);

    // Check if current user is already in this call
    const isInThisCall = activeCall?.room_id === roomId;

    const handleClick = async () => {
        if (disabled || isLoading || connectionStatus === 'connecting') return;

        // If in call, end it
        if (isInThisCall) {
            leaveCall();
            return;
        }

        setIsLoading(true);
        try {
            if (roomActiveCall && !isInThisCall) {
                // Join existing call
                await joinCall(roomActiveCall.id);
            } else if (!activeCall) {
                // Start new call
                await createCall(roomId, roomType, roomName);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Don't show button if already in a call for a different room
    if (activeCall && !isInThisCall) {
        return null;
    }

    const isConnecting = connectionStatus === 'connecting' || isLoading;
    const hasActiveCall = roomActiveCall && !isInThisCall;

    // Disabled style
    if (disabled) {
        return (
            <button
                disabled
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
                    bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed
                    ${className}
                `}
                title={t('voip.callsDisabled') || 'Voice calls are disabled in this room'}
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                </svg>
            </button>
        );
    }

    // Bordered variant styling (for DM headers)
    const borderedButtonClasses = isInThisCall
        ? 'border border-red-500 text-red-500 hover:bg-red-500/10'
        : hasActiveCall
            ? 'border border-green-500 text-green-500 hover:bg-green-500/10'
            : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';

    // Default variant styling
    const defaultButtonClasses = isInThisCall
        ? 'bg-green-500/20 text-green-400 cursor-default'
        : hasActiveCall
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'theme-bg-tertiary hover:bg-opacity-80 theme-text-primary';

    return (
        <button
            onClick={handleClick}
            disabled={isConnecting}
            className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
                ${variant === 'bordered' ? borderedButtonClasses : defaultButtonClasses}
                ${isConnecting ? 'opacity-50 cursor-wait' : ''}
                ${className}
            `}
            title={isInThisCall
                ? t('voip.endCall') || 'End Call'
                : hasActiveCall
                    ? t('voip.joinCall') || 'Join Call'
                    : t('voip.startCall') || 'Start Call'
            }
        >
            {isConnecting ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            ) : isInThisCall ? (
                // End call icon (phone with x)
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
            ) : hasActiveCall ? (
                // Active call - phone with users
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
            ) : (
                // Start call - phone icon
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
            )}

            {hasActiveCall && (
                <span className="text-sm font-medium">
                    {t('voip.joinCall') || 'Join Call'}
                    {roomActiveCall.participants?.length > 0 && (
                        <span className="ml-1 text-xs opacity-75">
                            ({roomActiveCall.participants.length})
                        </span>
                    )}
                </span>
            )}
        </button>
    );
};

export default VoipButton;

