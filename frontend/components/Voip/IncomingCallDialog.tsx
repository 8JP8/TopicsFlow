import React, { useEffect, useState } from 'react';
import { useVoip } from '@/contexts/VoipContext';
import { useLanguage } from '@/contexts/LanguageContext';

const IncomingCallDialog: React.FC = () => {
    const { incomingCall, acceptIncomingCall, declineIncomingCall } = useVoip();
    const { t } = useLanguage();
    const [timeLeft, setTimeLeft] = useState(30);

    // Auto-dismiss after 30 seconds
    useEffect(() => {
        if (!incomingCall) {
            setTimeLeft(30);
            return;
        }

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    declineIncomingCall();
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [incomingCall, declineIncomingCall]);

    if (!incomingCall) return null;

    const { caller, call } = incomingCall;
    const isDM = call.room_type === 'dm';

    // Different text based on call type
    const getCallTitle = () => {
        if (isDM) {
            return t('voip.incomingCallDM') || 'Incoming Call';
        }
        return t('voip.groupCallStarted') || 'Voice Call Started';
    };

    const getCallMessage = () => {
        if (isDM) {
            return t('voip.callingYou', { name: caller.username }) || `${caller.username} is calling you`;
        }
        return t('voip.startedVoiceCallOn', { name: caller.username, group: call.room_name || 'group' }) ||
            `${caller.username} started a voice call on ${call.room_name || 'group'}`;
    };

    // Different button labels based on call type
    const getAcceptLabel = () => {
        if (isDM) {
            return t('voip.answer') || 'Answer';
        }
        return t('voip.join') || 'Join';
    };

    const getDeclineLabel = () => {
        if (isDM) {
            return t('voip.decline') || 'Decline';
        }
        return t('voip.dismiss') || 'Dismiss';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={declineIncomingCall}
            />

            {/* Dialog */}
            <div className="relative theme-bg-primary border theme-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-bounce-in">
                {/* Timer */}
                <div className="absolute top-3 right-3 text-xs theme-text-muted">
                    {timeLeft}s
                </div>

                {/* Caller Info */}
                <div className="flex flex-col items-center text-center mb-6">
                    {/* Avatar with pulsing ring */}
                    <div className="relative mb-4">
                        <div className={`w-20 h-20 rounded-full overflow-hidden theme-bg-tertiary ring-4 ${isDM ? 'ring-green-400/50' : 'ring-blue-400/50'} animate-pulse`}>
                            {caller.profile_picture ? (
                                <img
                                    src={caller.profile_picture.startsWith('data:')
                                        ? caller.profile_picture
                                        : `data:image/jpeg;base64,${caller.profile_picture}`
                                    }
                                    alt={caller.username}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-2xl font-bold theme-text-primary">
                                        {caller.username.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>
                        {/* Phone/Voice icon */}
                        <div className={`absolute -bottom-1 -right-1 w-8 h-8 ${isDM ? 'bg-green-500' : 'bg-blue-500'} rounded-full flex items-center justify-center animate-bounce`}>
                            {isDM ? (
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                                </svg>
                            )}
                        </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold theme-text-primary mb-1">
                        {getCallTitle()}
                    </h3>

                    {/* Call message */}
                    <p className="text-sm theme-text-secondary">
                        {getCallMessage()}
                    </p>

                    {/* Group name badge for group calls */}
                    {!isDM && call.room_name && (
                        <div className="mt-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                            {call.room_name}
                        </div>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-4 justify-center">
                    {/* Decline/Dismiss */}
                    <button
                        onClick={declineIncomingCall}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 ${isDM ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'} text-white rounded-full transition-all transform hover:scale-105`}
                    >
                        {isDM ? (
                            <svg className="w-5 h-5 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                        )}
                        <span className="font-medium">{getDeclineLabel()}</span>
                    </button>

                    {/* Accept/Join */}
                    <button
                        onClick={acceptIncomingCall}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 ${isDM ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-full transition-all transform hover:scale-105`}
                    >
                        {isDM ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                            </svg>
                        )}
                        <span className="font-medium">{getAcceptLabel()}</span>
                    </button>
                </div>
            </div>

            {/* CSS Animation */}
            <style jsx>{`
        @keyframes bounce-in {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.3s ease-out;
        }
      `}</style>
        </div>
    );
};

export default IncomingCallDialog;

