import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { toast } from 'react-hot-toast';

// STUN servers for WebRTC - using Google's free public STUN servers
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

interface VoipParticipant {
    user_id: string;
    username?: string;
    profile_picture?: string;
    joined_at: string;
    last_heartbeat?: string;
    is_muted: boolean;
    is_disconnected?: boolean;
}

interface VoipCall {
    id: string;
    room_id: string;
    room_type: 'group' | 'dm';
    room_name?: string;
    created_at: string;
    created_by: string;
    participants: VoipParticipant[];
    status: 'active' | 'ended';
}

interface IncomingCall {
    call: VoipCall;
    caller: {
        id: string;
        username: string;
        profile_picture?: string;
    };
}

interface PeerConnection {
    userId: string;
    connection: RTCPeerConnection;
    audioStream?: MediaStream;
}

interface VoipContextType {
    // State
    activeCall: VoipCall | null;
    participants: VoipParticipant[];
    isMuted: boolean;
    connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
    speakingUsers: Set<string>;
    microphoneThreshold: number;
    incomingCall: IncomingCall | null;
    currentMicrophoneLevel: number;
    isTestingMicrophone: boolean;
    availableDevices: MediaDeviceInfo[];
    selectedDeviceId: string;
    isDocked: boolean;
    echoCancellation: boolean;
    noiseSuppression: boolean;

    // Actions
    setIsDocked: (value: boolean) => void;
    setEchoCancellation: (value: boolean) => void;
    setNoiseSuppression: (value: boolean) => void;
    createCall: (roomId: string, roomType: 'group' | 'dm', roomName?: string) => Promise<void>;
    joinCall: (callId: string) => Promise<void>;
    leaveCall: () => void;
    toggleMute: () => void;
    setMicrophoneThreshold: (value: number) => void;
    acceptIncomingCall: () => void;
    declineIncomingCall: () => void;
    checkActiveCall: (roomId: string) => void;
    startMicrophoneTest: () => Promise<void>;
    stopMicrophoneTest: () => void;
    selectMicrophoneDevice: (deviceId: string) => Promise<void>;
    refreshDevices: () => Promise<void>;
}

const VoipContext = createContext<VoipContextType | undefined>(undefined);

export const useVoip = () => {
    const context = useContext(VoipContext);
    if (context === undefined) {
        // During SSR, return a safe default
        if (typeof window === 'undefined') {
            return {
                activeCall: null,
                participants: [],
                isMuted: false,
                connectionStatus: 'disconnected' as const,
                speakingUsers: new Set<string>(),
                microphoneThreshold: 25,
                incomingCall: null,
                currentMicrophoneLevel: 0,
                isTestingMicrophone: false,
                availableDevices: [],
                selectedDeviceId: '',
                isDocked: false,
                echoCancellation: true,
                noiseSuppression: true,
                setIsDocked: () => { },
                setEchoCancellation: () => { },
                setNoiseSuppression: () => { },
                createCall: async () => { },
                joinCall: async () => { },
                leaveCall: () => { },
                toggleMute: () => { },
                setMicrophoneThreshold: () => { },
                acceptIncomingCall: () => { },
                declineIncomingCall: () => { },
                checkActiveCall: () => { },
                startMicrophoneTest: async () => { },
                stopMicrophoneTest: () => { },
                selectMicrophoneDevice: async () => { },
                refreshDevices: async () => { },
            } as VoipContextType;
        }
        throw new Error('useVoip must be used within a VoipProvider');
    }
    return context;
};

interface VoipProviderProps {
    children: ReactNode;
}

export const VoipProvider: React.FC<VoipProviderProps> = ({ children }) => {
    const { socket, connected } = useSocket();
    const { user } = useAuth();
    const { t } = useLanguage();

    // State
    const [activeCall, setActiveCall] = useState<VoipCall | null>(null);
    const [participants, setParticipants] = useState<VoipParticipant[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
    const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
    const [microphoneThreshold, setMicrophoneThreshold] = useState(25);
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const [currentMicrophoneLevel, setCurrentMicrophoneLevel] = useState(0);
    const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isDocked, setIsDocked] = useState(false);
    const [echoCancellation, setEchoCancellation] = useState(true);
    const [noiseSuppression, setNoiseSuppression] = useState(true);

    // State for remote streams (explicit rendering to prevent GC)
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

    // Refs
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const testStreamRef = useRef<MediaStream | null>(null);

    // Refs to track current values for VAD closure
    const activeCallRef = useRef<VoipCall | null>(null);
    // Track if effect update is needed to avoid initial mount double-trigger
    const isFirstMountRef = useRef(true);
    const socketRef = useRef(socket);
    const connectedRef = useRef(connected);
    const userRef = useRef(user);
    const isMutedRef = useRef(false);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Keep refs in sync with state
    useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
    useEffect(() => { socketRef.current = socket; }, [socket]);
    useEffect(() => { connectedRef.current = connected; }, [connected]);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => {
        isMutedRef.current = isMuted;
        localStorage.setItem('voip_is_muted', String(isMuted));
    }, [isMuted]);

    // Load settings
    useEffect(() => {
        const savedThreshold = localStorage.getItem('voip_microphone_threshold');
        if (savedThreshold) setMicrophoneThreshold(parseInt(savedThreshold, 10));
        const savedDevice = localStorage.getItem('voip_selected_device');
        if (savedDevice) setSelectedDeviceId(savedDevice);

        const savedEcho = localStorage.getItem('voip_echo_cancellation');
        if (savedEcho !== null) setEchoCancellation(savedEcho === 'true');

        const savedNoise = localStorage.getItem('voip_noise_suppression');
        if (savedNoise !== null) setNoiseSuppression(savedNoise === 'true');
    }, []);

    const handleSetMicrophoneThreshold = useCallback((value: number) => {
        setMicrophoneThreshold(value);
        localStorage.setItem('voip_microphone_threshold', value.toString());
    }, []);

    const handleSetEchoCancellation = useCallback((value: boolean) => {
        setEchoCancellation(value);
        localStorage.setItem('voip_echo_cancellation', String(value));
    }, []);

    const handleSetNoiseSuppression = useCallback((value: boolean) => {
        setNoiseSuppression(value);
        localStorage.setItem('voip_noise_suppression', String(value));
    }, []);

    const refreshDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAvailableDevices(devices.filter(d => d.kind === 'audioinput'));
        } catch (error) {
            console.error('[VOIP] Failed to enumerate devices:', error);
        }
    }, []);

    useEffect(() => {
        refreshDevices();
        navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    }, [refreshDevices]);

    // VAD - VISUAL ONLY (Relaxed)
    const startVoiceActivityDetection = useCallback((stream: MediaStream) => {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 512;
            source.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            let wasSpeaking = false;

            // CRITICAL FIX: Ensure audio tracks are ENABLED by default
            stream.getAudioTracks().forEach(track => {
                track.enabled = !isMutedRef.current;
            });

            const checkLevel = () => {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const level = Math.min(100, (average / 128) * 100);
                setCurrentMicrophoneLevel(level);

                const isSpeaking = level > microphoneThreshold;
                const isManuallyMuted = isMutedRef.current;

                // CRITICAL FIX: DO NOT toggle track.enabled here. 
                // Let audio flow naturally. Only use this for visual indicators.

                if (isSpeaking !== wasSpeaking && activeCallRef.current && socketRef.current && connectedRef.current && userRef.current) {
                    socketRef.current.emit('voip_speaking', {
                        call_id: activeCallRef.current.id,
                        is_speaking: isSpeaking && !isManuallyMuted
                    });
                    wasSpeaking = isSpeaking;

                    if (isSpeaking && !isManuallyMuted) {
                        setSpeakingUsers(prev => new Set([...prev, userRef.current!.id]));
                    } else {
                        setSpeakingUsers(prev => {
                            const next = new Set(prev);
                            next.delete(userRef.current!.id);
                            return next;
                        });
                    }
                }
                animationFrameRef.current = requestAnimationFrame(checkLevel);
            };
            checkLevel();
        } catch (error) {
            console.error('[VOIP] VAD init failed:', error);
        }
    }, [microphoneThreshold]);

    const stopVoiceActivityDetection = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        setCurrentMicrophoneLevel(0);
    }, []);

    const getUserMedia = useCallback(async (deviceId?: string): Promise<MediaStream> => {
        const constraints = {
            audio: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                echoCancellation: echoCancellation,
                noiseSuppression: noiseSuppression,
            },
            video: false
        };
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error: any) {
            console.error('[VOIP] getUserMedia failed:', error);
            toast.error(t('voip.microphoneError') || 'Microphone error');
            throw error;
        }
    }, [t, echoCancellation, noiseSuppression]);

    const createPeerConnection = useCallback((targetUserId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        }

        pc.onicecandidate = (event) => {
            if (event.candidate && socket && connected && activeCall) {
                socket.emit('voip_ice_candidate', {
                    call_id: activeCall.id,
                    target_user_id: targetUserId,
                    candidate: event.candidate
                });
            }
        };

        // CRITICAL FIX: Store remote stream in state for explicit rendering
        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            console.log(`[VOIP] Received remote stream from ${targetUserId}`);

            setRemoteStreams(prev => {
                const newMap = new Map(prev);
                newMap.set(targetUserId, remoteStream);
                return newMap;
            });

            // Fallback: still try to play directly just in case (but state rendering is primary)
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play().catch(e => console.error('[VOIP] Audio play fallback failed:', e));
        };

        pc.onconnectionstatechange = () => {
            console.log(`[VOIP] PC state (${targetUserId}):`, pc.connectionState);
            if (pc.connectionState === 'connected') setConnectionStatus('connected');
            else if (pc.connectionState === 'failed') setConnectionStatus('reconnecting');
        };

        peerConnectionsRef.current.set(targetUserId, { userId: targetUserId, connection: pc });
        return pc;
    }, [socket, connected, activeCall]);

    const cleanup = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        peerConnectionsRef.current.forEach(({ connection }) => connection.close());
        peerConnectionsRef.current.clear();
        setRemoteStreams(new Map()); // Clear remote streams
        stopVoiceActivityDetection();
        setActiveCall(null);
        setParticipants([]);
        setConnectionStatus('disconnected');
        setSpeakingUsers(new Set());
        setIsMuted(false);
    }, [stopVoiceActivityDetection]);

    // Initialize peer connections with a list of participants
    const initializePeerConnections = useCallback(async (callId: string, currentParticipants: VoipParticipant[]) => {
        if (!user || !socket || !connected) return;

        console.log('[VOIP] Initializing peer connections for participants:', currentParticipants.length);

        for (const participant of currentParticipants) {
            // Skip self
            if (participant.user_id === user.id) continue;

            try {
                // If we already have a connection, check its state
                if (peerConnectionsRef.current.has(participant.user_id)) {
                    const pc = peerConnectionsRef.current.get(participant.user_id)?.connection;
                    if (pc && (pc.connectionState === 'connected' || pc.connectionState === 'connecting')) {
                        console.log(`[VOIP] Connection already healthy for ${participant.user_id}`);
                        continue;
                    }
                    // Close unhealthy connection
                    if (pc) pc.close();
                }

                console.log(`[VOIP] Creating offer for ${participant.user_id}`);
                const pc = createPeerConnection(participant.user_id);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socket.emit('voip_offer', {
                    call_id: callId,
                    target_user_id: participant.user_id,
                    offer: offer
                });
            } catch (error) {
                console.error(`[VOIP] Failed to create offer for ${participant.user_id}:`, error);
            }
        }
    }, [user, socket, connected, createPeerConnection]);

    // Create call
    const createCall = useCallback(async (roomId: string, roomType: 'group' | 'dm', roomName?: string) => {
        if (!socket || !connected) {
            toast.error(t('toast.notConnected') || 'Not connected to server');
            return;
        }

        setConnectionStatus('connecting');

        try {
            // Request microphone permission
            localStreamRef.current = await getUserMedia(selectedDeviceId || undefined);

            // Start VAD
            startVoiceActivityDetection(localStreamRef.current);

            // Create call via socket
            socket.emit('voip_create_call', {
                room_id: roomId,
                room_type: roomType,
                room_name: roomName
            });

            // Set timeout to prevent infinite loading
            setTimeout(() => {
                if (connectionStatus === 'connecting' && !activeCallRef.current) {
                    console.warn('[VOIP] Call creation timed out');
                    setConnectionStatus('disconnected');
                    cleanup();
                    toast.error(t('voip.connectionTimedOut') || 'Connection timed out');
                }
            }, 15000);

        } catch (error) {
            setConnectionStatus('disconnected');
            cleanup();
        }
    }, [socket, connected, t, getUserMedia, selectedDeviceId, startVoiceActivityDetection, cleanup, connectionStatus]);

    // Join call
    const joinCall = useCallback(async (callId: string) => {
        if (!socket || !connected) {
            toast.error(t('toast.notConnected') || 'Not connected to server');
            return;
        }

        setConnectionStatus('connecting');

        try {
            // Request microphone permission
            localStreamRef.current = await getUserMedia(selectedDeviceId || undefined);

            // Start VAD
            startVoiceActivityDetection(localStreamRef.current);

            // Join call via socket
            socket.emit('voip_join_call', { call_id: callId });

            // Set timeout to prevent infinite loading
            setTimeout(() => {
                if (connectionStatus === 'connecting' && !activeCallRef.current) {
                    console.warn('[VOIP] Join call timed out');
                    setConnectionStatus('disconnected');
                    cleanup();
                    toast.error(t('voip.connectionTimedOut') || 'Connection timed out');
                }
            }, 15000);
        } catch (error) {
            setConnectionStatus('disconnected');
            cleanup();
        }
    }, [socket, connected, t, getUserMedia, selectedDeviceId, startVoiceActivityDetection, cleanup, connectionStatus]);

    // Leave call
    const leaveCall = useCallback(() => {
        if (socket && connected && activeCall) {
            socket.emit('voip_leave_call', { call_id: activeCall.id });
        }
        cleanup();
    }, [socket, connected, activeCall, cleanup]);

    // Toggle mute - when muted, VAD won't enable audio tracks
    const toggleMute = useCallback(() => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);

        // When muting, immediately disable audio tracks
        // When unmuting, let VAD control the tracks based on speaking
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !newMuted; // CRITICAL: Just respect mute state, ignore VAD for enablement
            });
        }

        if (newMuted && user) {
            setSpeakingUsers(prev => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
            });
        }

        // Notify server
        if (socket && connected && activeCall) {
            socket.emit('voip_mute_toggle', {
                call_id: activeCall.id,
                is_muted: newMuted
            });
        }
    }, [isMuted, socket, connected, activeCall, user]);

    // Accept incoming call
    const acceptIncomingCall = useCallback(() => {
        if (incomingCall) {
            joinCall(incomingCall.call.id);
            setIncomingCall(null);
        }
    }, [incomingCall, joinCall]);

    // Decline incoming call
    const declineIncomingCall = useCallback(() => {
        // Close any browser notification for this call
        if (incomingCall?.call?.id && typeof window !== 'undefined' && 'Notification' in window) {
            // Cannot close notification directly, but clearing tag prevents duplicate
        }
        setIncomingCall(null);
    }, [incomingCall]);

    // Check for active call in room
    const checkActiveCall = useCallback((roomId: string) => {
        if (socket && connected) {
            socket.emit('voip_get_active_call', { room_id: roomId });
        }
    }, [socket, connected]);

    // Microphone test functions
    const startMicrophoneTest = useCallback(async () => {
        try {
            testStreamRef.current = await getUserMedia(selectedDeviceId || undefined);
            setIsTestingMicrophone(true);
            startVoiceActivityDetection(testStreamRef.current);
        } catch (error) {
            console.error('[VOIP] Microphone test failed:', error);
        }
    }, [getUserMedia, selectedDeviceId, startVoiceActivityDetection]);

    const stopMicrophoneTest = useCallback(() => {
        if (testStreamRef.current) {
            testStreamRef.current.getTracks().forEach(track => track.stop());
            testStreamRef.current = null;
        }
        stopVoiceActivityDetection();
        setIsTestingMicrophone(false);
    }, [stopVoiceActivityDetection]);

    // Select microphone device
    const selectMicrophoneDevice = useCallback(async (deviceId: string) => {
        setSelectedDeviceId(deviceId);
        localStorage.setItem('voip_selected_device', deviceId);

        // If in a call, switch device
        if (activeCall && localStreamRef.current) {
            try {
                const newStream = await getUserMedia(deviceId);

                // Replace tracks in all peer connections
                const audioTrack = newStream.getAudioTracks()[0];
                peerConnectionsRef.current.forEach(({ connection }) => {
                    const sender = connection.getSenders().find(s => s.track?.kind === 'audio');
                    if (sender) {
                        sender.replaceTrack(audioTrack);
                    }
                });

                // Stop old tracks
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = newStream;

                // Restart VAD with new stream
                stopVoiceActivityDetection();
                startVoiceActivityDetection(newStream);
            } catch (error) {
                console.error('[VOIP] Failed to switch device:', error);
            }
        }
    }, [activeCall, getUserMedia, stopVoiceActivityDetection, startVoiceActivityDetection]);

    // Handle changes to echo/noise settings while active
    useEffect(() => {
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            return;
        }

        // Only trigger if we have an active stream and device is selected
        if (localStreamRef.current && selectedDeviceId) {
            const updateStream = async () => {
                console.log('[VOIP] Updating audio constraints...', { echoCancellation, noiseSuppression });
                try {
                    const newStream = await getUserMedia(selectedDeviceId);

                    // Replace tracks in all peer connections
                    const audioTrack = newStream.getAudioTracks()[0];
                    peerConnectionsRef.current.forEach(({ connection }) => {
                        const sender = connection.getSenders().find(s => s.track?.kind === 'audio');
                        if (sender) {
                            sender.replaceTrack(audioTrack);
                        }
                    });

                    // Stop old tracks
                    if (localStreamRef.current) {
                        localStreamRef.current.getTracks().forEach(track => track.stop());
                    }

                    localStreamRef.current = newStream;

                    // Restart VAD with new stream
                    stopVoiceActivityDetection();
                    startVoiceActivityDetection(newStream);
                } catch (error) {
                    console.error('[VOIP] Failed to update audio constraints:', error);
                }
            };

            updateStream();
        }
    }, [echoCancellation, noiseSuppression, selectedDeviceId, getUserMedia, startVoiceActivityDetection, stopVoiceActivityDetection]);





    // Socket event handlers
    useEffect(() => {
        if (!socket) return;

        const handlers: Record<string, (data: any) => void> = {
            'voip_call_created': (data) => {
                console.log('[VOIP] Call created:', data);
                setActiveCall(data.call);
                // Enrich participants with current user if not present
                const existingParticipants = data.call.participants || [];
                const hasCurrentUser = existingParticipants.some((p: VoipParticipant) => p.user_id === user?.id);

                if (!hasCurrentUser && user) {
                    setParticipants([...existingParticipants, {
                        user_id: user.id,
                        username: user.username,
                        profile_picture: user.profile_picture,
                        joined_at: new Date().toISOString(),
                        is_muted: false
                    }]);
                } else {
                    setParticipants(existingParticipants);
                }
                setConnectionStatus('connected');
            },

            'voip_call_exists': (data) => {
                console.log('[VOIP] Call already exists:', data);
                toast(t('voip.callAlreadyActive') || 'A call is already active');
                // Join the existing call instead
                if (data.call) {
                    joinCall(data.call.id);
                }
            },

            'voip_call_joined': async (data) => {
                console.log('[VOIP] Joined call:', data);
                setActiveCall(data.call);

                // Enrich participants with current user if not present
                const existingParticipants = data.call.participants || [];
                const hasCurrentUser = existingParticipants.some((p: VoipParticipant) => p.user_id === user?.id);

                if (!hasCurrentUser && user) {
                    setParticipants([...existingParticipants, {
                        user_id: user.id,
                        username: user.username,
                        profile_picture: user.profile_picture,
                        joined_at: new Date().toISOString(),
                        is_muted: false
                    }]);
                } else {
                    setParticipants(existingParticipants);
                }
                setConnectionStatus('connected');

                // Initialize connections with all existing participants
                await initializePeerConnections(data.call.id, data.call.participants || []);
            },

            'voip_user_joined': async (data) => {
                console.log('[VOIP] User joined:', data);

                // Skip if this is current user or data is missing
                if (!data.user?.id) {
                    console.warn('[VOIP] User joined event missing user data');
                    return;
                }

                setParticipants(prev => {
                    // Check for existing participant
                    const existing = prev.find(p => p.user_id === data.user.id);
                    if (existing) return prev;

                    return [...prev, {
                        user_id: data.user.id,
                        username: data.user.username,
                        profile_picture: data.user.profile_picture,
                        joined_at: new Date().toISOString(),
                        is_muted: false
                    }];
                });



                // NO offer creation here to avoid glare/race conditions.
                // The new user (who just joined) will initiate offers to us via their 'voip_call_joined' handler.
                // We just wait for 'voip_offer' event from them.
            },

            'voip_user_left': (data) => {
                console.log('[VOIP] User left:', data);
                setParticipants(prev => prev.filter(p => p.user_id !== data.user.id));

                // Close peer connection
                const peerData = peerConnectionsRef.current.get(data.user.id);
                if (peerData) {
                    peerData.connection.close();
                    peerConnectionsRef.current.delete(data.user.id);
                }

                // Remove from speaking
                setSpeakingUsers(prev => {
                    const next = new Set(prev);
                    next.delete(data.user.id);
                    return next;
                });
            },

            'voip_left_call': (data) => {
                console.log('[VOIP] Left call:', data);
                cleanup();
            },

            'voip_call_ended': (data) => {
                console.log('[VOIP] Call ended:', data);
                toast(t('voip.callEnded') || 'Call ended');
                cleanup();

                // Dispatch event for VoipButton to clear its state
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('voip_call_ended', {
                        detail: { room_id: data.room_id, call: data.call }
                    }));
                }
            },

            'voip_incoming_call': (data) => {
                console.log('[VOIP] Incoming call:', data);
                if (!activeCall) {
                    setIncomingCall(data);

                    // Show browser notification for DM calls
                    if (typeof window !== 'undefined' && 'Notification' in window) {
                        if (Notification.permission === 'granted') {
                            const notification = new Notification(
                                data.caller?.username ? `${data.caller.username} is calling you` : 'Incoming Call',
                                {
                                    body: 'Click to answer the call',
                                    icon: '/favicon.ico',
                                    tag: `voip_call_${data.call?.id}`,
                                    requireInteraction: true
                                }
                            );
                            notification.onclick = () => {
                                window.focus();
                                notification.close();
                            };
                        } else if (Notification.permission !== 'denied') {
                            Notification.requestPermission();
                        }
                    }
                }
            },

            'voip_call_started': (data) => {
                console.log('[VOIP] Call started in room:', data);
                // Show incoming call dialog for group calls (only if not already in a call)
                if (!activeCall && data.call && data.started_by) {
                    setIncomingCall({
                        call: data.call,
                        caller: data.started_by
                    });

                    // Show browser notification for group calls
                    if (typeof window !== 'undefined' && 'Notification' in window) {
                        if (Notification.permission === 'granted') {
                            const callerName = data.started_by?.username || 'Someone';
                            const groupName = data.call?.room_name || 'a group';
                            const notification = new Notification(
                                `${callerName} started a voice call`,
                                {
                                    body: `Voice call in ${groupName}`,
                                    icon: '/favicon.ico',
                                    tag: `voip_call_${data.call?.id}`,
                                    requireInteraction: true
                                }
                            );
                            notification.onclick = () => {
                                window.focus();
                                notification.close();
                            };
                        } else if (Notification.permission !== 'denied') {
                            Notification.requestPermission();
                        }
                    }
                }
                // Also dispatch window event for VoipButton to update
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('voip_call_started', { detail: data }));
                }
            },

            'voip_offer': async (data) => {
                console.log('[VOIP] Received offer from:', data.from_user_id);
                if (!activeCall) return;

                try {
                    let pc = peerConnectionsRef.current.get(data.from_user_id)?.connection;
                    if (!pc) {
                        pc = createPeerConnection(data.from_user_id);
                    }

                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    socket.emit('voip_answer', {
                        call_id: data.call_id,
                        target_user_id: data.from_user_id,
                        answer: answer
                    });
                } catch (error) {
                    console.error('[VOIP] Failed to handle offer:', error);
                }
            },

            'voip_answer': async (data) => {
                console.log('[VOIP] Received answer from:', data.from_user_id);
                const peerData = peerConnectionsRef.current.get(data.from_user_id);
                if (peerData) {
                    try {
                        await peerData.connection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    } catch (error) {
                        console.error('[VOIP] Failed to set remote description:', error);
                    }
                }
            },

            'voip_ice_candidate': async (data) => {
                const peerData = peerConnectionsRef.current.get(data.from_user_id);
                if (peerData) {
                    try {
                        await peerData.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } catch (error) {
                        console.error('[VOIP] Failed to add ICE candidate:', error);
                    }
                }
            },

            'voip_speaking_status': (data) => {
                console.log('[VOIP] Speaking status update:', data);
                setSpeakingUsers(prev => {
                    const next = new Set(prev);
                    if (data.is_speaking) {
                        next.add(data.user_id);
                    } else {
                        next.delete(data.user_id);
                    }
                    console.log('[VOIP] Speaking users:', Array.from(next));
                    return next;
                });
            },

            'voip_mute_status': (data) => {
                setParticipants(prev =>
                    prev.map(p =>
                        p.user_id === data.user_id
                            ? { ...p, is_muted: data.is_muted }
                            : p
                    )
                );
            },

            'voip_active_call': (data) => {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('voip_active_call', { detail: data }));
                }
            },

            'voip_my_call': async (data) => {
                console.log('[VOIP] My call data:', data);
                if (data.call && data.call.status === 'active') {
                    // Restore call state after reconnection/page refresh
                    setActiveCall(data.call);
                    setParticipants(data.call.participants || []);
                    setConnectionStatus('connected');

                    // Restore mute state from localStorage
                    const savedMuteState = localStorage.getItem('voip_is_muted');
                    if (savedMuteState === 'true') {
                        setIsMuted(true);
                    }

                    // Re-request microphone and start VAD
                    try {
                        const savedDeviceId = localStorage.getItem('voip_selected_device');
                        localStreamRef.current = await getUserMedia(savedDeviceId || undefined);
                        startVoiceActivityDetection(localStreamRef.current);
                        console.log('[VOIP] Reconnected to call:', data.call.id);

                        // Initialize connections with participants
                        await initializePeerConnections(data.call.id, data.call.participants || []);
                    } catch (error) {
                        console.error('[VOIP] Failed to restore microphone on reconnection:', error);
                    }
                }
            },

            'voip_user_disconnected': (data) => {
                console.log('[VOIP] User disconnected status:', data);
                setParticipants(prev =>
                    prev.map(p =>
                        p.user_id === data.user_id
                            ? { ...p, is_disconnected: data.is_disconnected }
                            : p
                    )
                );
            },

            'voip_error': (data) => {
                console.error('[VOIP] Error:', data.message);
                toast.error(data.message);
                if (connectionStatus === 'connecting') {
                    setConnectionStatus('disconnected');
                }
            }
        };

        // Register handlers
        Object.entries(handlers).forEach(([event, handler]) => {
            socket.on(event, handler);
        });

        // Cleanup
        return () => {
            Object.entries(handlers).forEach(([event, handler]) => {
                socket.off(event, handler);
            });
        };
    }, [socket, user, activeCall, connectionStatus, t, createPeerConnection, cleanup, joinCall, getUserMedia, startVoiceActivityDetection]);

    // Heartbeat interval - send every 30 seconds while in a call
    useEffect(() => {
        if (activeCall && socket && connected) {
            // Start heartbeat
            heartbeatIntervalRef.current = setInterval(() => {
                socket.emit('voip_heartbeat', { call_id: activeCall.id });
            }, 30000); // 30 seconds

            // Send initial heartbeat
            socket.emit('voip_heartbeat', { call_id: activeCall.id });
        }

        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        };
    }, [activeCall, socket, connected]);

    // Reconnect to call when socket reconnects after disconnect
    useEffect(() => {
        if (socket && connected && user && !activeCall) {
            // Check if we were in a call before disconnect
            socket.emit('voip_get_my_call');
        }
    }, [socket, connected, user, activeCall]);

    // Handle user logout - ensure call is cleaned up
    useEffect(() => {
        if (!user && activeCall) {
            console.log('[VOIP] User logged out, cleaning up call');
            leaveCall();
        }
    }, [user, activeCall, leaveCall]);

    // Handle socket disconnect - mark self as disconnected
    useEffect(() => {
        if (!socket) return;

        const handleDisconnect = () => {
            if (activeCall) {
                setConnectionStatus('reconnecting');
                console.log('[VOIP] Socket disconnected while in call, will attempt reconnect...');
            }
        };

        const handleReconnect = () => {
            if (activeCall) {
                console.log('[VOIP] Socket reconnected, restoring call...');
                // Emit join_call to ensure socket is re-added to the signaling room
                socket.emit('voip_join_call', { call_id: activeCall.id });
                setConnectionStatus('connected');
            }
        };

        socket.on('disconnect', handleDisconnect);
        socket.on('connect', handleReconnect);

        return () => {
            socket.off('disconnect', handleDisconnect);
            socket.off('connect', handleReconnect);
        };
    }, [socket, activeCall]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
            stopMicrophoneTest();
        };
    }, [stopMicrophoneTest]);

    const value: VoipContextType = {
        activeCall,
        participants,
        isMuted,
        connectionStatus,
        speakingUsers,
        microphoneThreshold,
        incomingCall,
        currentMicrophoneLevel,
        isTestingMicrophone,
        availableDevices,
        selectedDeviceId,
        createCall,
        joinCall,
        leaveCall,
        toggleMute,
        setMicrophoneThreshold: handleSetMicrophoneThreshold,
        acceptIncomingCall,
        declineIncomingCall,
        checkActiveCall,
        startMicrophoneTest,
        stopMicrophoneTest,
        selectMicrophoneDevice,
        refreshDevices,
        isDocked,
        setIsDocked,
        echoCancellation,
        noiseSuppression,
        setEchoCancellation: handleSetEchoCancellation,
        setNoiseSuppression: handleSetNoiseSuppression,
    };

    return (
        <VoipContext.Provider value={value}>
            {children}
            {/* Explicitly render audio elements for all remote streams to prevent GC and ensure playback */}
            {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
                <audio
                    key={userId}
                    ref={(el) => {
                        if (el && el.srcObject !== stream) {
                            el.srcObject = stream;
                            el.play().catch(e => console.error(`[VOIP] Failed to play remote audio for ${userId}:`, e));
                        }
                    }}
                    autoPlay
                    playsInline
                    controls={false}
                    style={{ display: 'none' }} // Hidden but active
                />
            ))}
        </VoipContext.Provider>
    );
};

export default VoipContext;
