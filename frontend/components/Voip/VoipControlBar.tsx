import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useVoip } from '@/contexts/VoipContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import VoipParticipant from './VoipParticipant';

interface VoipControlBarProps {
    variant?: 'embedded' | 'floating';
    showLabels?: boolean;
    onDock?: () => void;
    isDocked?: boolean;
}

const VoipControlBar: React.FC<VoipControlBarProps> = ({
    variant = 'embedded',
    showLabels = false,
    onDock,
    isDocked = false
}) => {
    const {
        activeCall,
        participants,
        isMuted,
        connectionStatus,
        leaveCall,
        toggleMute,
        availableDevices,
        selectedDeviceId,
        selectMicrophoneDevice,
    } = useVoip();
    const { t } = useLanguage();
    const { user } = useAuth();
    const router = useRouter();
    const [showDeviceMenu, setShowDeviceMenu] = useState(false);

    // Only show if there's an active call
    if (!activeCall) return null;

    const getStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return 'text-green-400';
            case 'connecting': return 'text-yellow-400';
            case 'reconnecting': return 'text-orange-400';
            case 'disconnected': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case 'connected': return t('voip.connected') || 'Connected';
            case 'connecting': return t('voip.connecting') || 'Connecting...';
            case 'reconnecting': return t('voip.reconnecting') || 'Reconnecting...';
            case 'disconnected': return t('voip.disconnected') || 'Disconnected';
            default: return '';
        }
    };

    const handleMuteRightClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (availableDevices.length > 0) {
            setShowDeviceMenu(!showDeviceMenu);
        }
    };

    const handleBackToChat = () => {
        if (!activeCall?.room_id) return;

        const goToHomeAndDispatch = (eventName: string, detail: any) => {
            if (router.pathname !== '/') {
                router.push('/').then(() => {
                    // Slight delay to ensure home page is mounted
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent(eventName, { detail }));
                    }, 300);
                });
            } else {
                window.dispatchEvent(new CustomEvent(eventName, { detail }));
            }
        };

        // Check if it's a DM (contains underscore and matches user IDs pattern)
        if (activeCall.room_id.includes('_') && user) {
            const parts = activeCall.room_id.split('_');
            if (parts.length === 2) {
                const otherUserId = parts.find(id => id !== user.id);
                if (otherUserId) {
                    const otherParticipant = participants.find(p => p.user_id === otherUserId);
                    goToHomeAndDispatch('openPrivateMessage', {
                        userId: otherUserId,
                        username: otherParticipant?.username || 'User'
                    });
                    return;
                }
            }
        }

        // Default to group chat (chatroom)
        goToHomeAndDispatch('openChatRoom', { chatRoomId: activeCall.room_id });
    };

    const containerClasses = variant === 'floating'
        ? 'w-full max-w-[320px] bg-white dark:bg-neutral-800 border theme-border rounded-xl shadow-2xl overflow-hidden'
        : 'theme-bg-secondary border-t theme-border';

    return (
        <div className={containerClasses}>
            {/* Status Bar */}
            <div className="px-3 py-2 flex items-center justify-between border-b theme-border bg-neutral-50 dark:bg-neutral-900/50">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
                    <span className={`text-xs font-medium ${getStatusColor()}`}>
                        {getStatusText()}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {variant === 'floating' ? (
                        <>
                            <button
                                onClick={handleBackToChat}
                                className="text-xs theme-text-primary font-medium hover:underline truncate max-w-[100px] flex items-center gap-1"
                                title={t('chat.backToChat') || 'Back to Chat'}
                            >
                                <span className="truncate">{activeCall.room_name || 'Voice Call'}</span>
                            </button>
                            {onDock && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation(); // Prevent drag start if needed
                                        onDock();
                                    }}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                    title={isDocked ? "Undock" : "Dock to bottom"}
                                >
                                    {isDocked ? (
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </>
                    ) : (
                        <span className="text-xs theme-text-muted truncate max-w-[150px]" title={activeCall.room_name}>
                            {activeCall.room_name || 'Voice Call'}
                        </span>
                    )}
                </div>
            </div>

            {/* Participants */}
            <div className="px-2 py-2 overflow-x-auto">
                <div className="flex gap-1 min-w-max">
                    {participants.map((participant) => (
                        <VoipParticipant
                            key={participant.user_id}
                            participant={participant}
                        />
                    ))}
                    {participants.length === 0 && (
                        <span className="text-xs theme-text-muted px-2">
                            {t('voip.noParticipants') || 'No participants'}
                        </span>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className={`px-3 py-2 flex items-center gap-2 border-t theme-border ${variant === 'floating' ? 'justify-between' : ''}`}>
                {/* Mute Button */}
                <div className="relative">
                    <button
                        onClick={toggleMute}
                        onContextMenu={handleMuteRightClick}
                        className={`
              flex items-center gap-2 px-3 py-2 rounded-lg transition-all
              ${isMuted
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'theme-bg-tertiary theme-text-primary hover:bg-opacity-80'
                            }
            `}
                        title={isMuted ? t('voip.unmute') || 'Unmute' : t('voip.mute') || 'Mute'}
                    >
                        {isMuted ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                            </svg>
                        )}
                        <span className={`text-sm font-medium ${variant === 'floating' && !showLabels ? 'hidden' : showLabels ? 'inline' : 'hidden sm:inline'}`}>
                            {isMuted ? t('voip.unmute') || 'Unmute' : t('voip.mute') || 'Mute'}
                        </span>
                    </button>

                    {/* Device Menu */}
                    {showDeviceMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 theme-bg-primary border theme-border rounded-lg shadow-xl z-50">
                            <div className="p-2 border-b theme-border">
                                <span className="text-xs font-medium theme-text-muted">
                                    {t('voip.selectMicrophone') || 'Select Microphone'}
                                </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                                {availableDevices.map((device) => (
                                    <button
                                        key={device.deviceId}
                                        onClick={() => {
                                            selectMicrophoneDevice(device.deviceId);
                                            setShowDeviceMenu(false);
                                        }}
                                        className={`
                      w-full px-3 py-2 text-left text-sm transition-colors
                      ${selectedDeviceId === device.deviceId
                                                ? 'theme-bg-tertiary theme-text-primary'
                                                : 'hover:theme-bg-secondary theme-text-secondary'
                                            }
                    `}
                                    >
                                        <div className="flex items-center gap-2">
                                            {selectedDeviceId === device.deviceId && (
                                                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                            <span className="truncate">
                                                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* End Call Button */}
                <button
                    onClick={leaveCall}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                    title={t('voip.endCall') || 'End Call'}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                    </svg>
                    <span className={`text-sm font-medium ${variant === 'floating' && !showLabels ? 'hidden' : showLabels ? 'inline' : 'hidden sm:inline'}`}>
                        {t('voip.endCall') || 'End Call'}
                    </span>
                </button>
            </div>

            {/* Click outside to close device menu */}
            {showDeviceMenu && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDeviceMenu(false)}
                />
            )}
        </div>
    );
};

export default VoipControlBar;
