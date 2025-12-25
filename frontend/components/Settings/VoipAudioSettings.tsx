import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useVoip } from '@/contexts/VoipContext';
import { useLanguage } from '@/contexts/LanguageContext';

const VoipAudioSettings: React.FC = () => {
    const {
        microphoneThreshold,
        setMicrophoneThreshold,
        availableDevices,
        selectedDeviceId,
        selectMicrophoneDevice,
        refreshDevices,
    } = useVoip();
    const { t } = useLanguage();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [currentLevel, setCurrentLevel] = useState(0);
    const [isActive, setIsActive] = useState(false);

    // Refs for audio processing
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Check microphone permission on mount
    useEffect(() => {
        const checkPermission = async () => {
            try {
                const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                setHasPermission(permission.state === 'granted');

                permission.addEventListener('change', () => {
                    setHasPermission(permission.state === 'granted');
                    if (permission.state === 'granted') {
                        refreshDevices();
                    }
                });
            } catch (error) {
                setHasPermission(null);
            }
        };

        checkPermission();
    }, [refreshDevices]);

    // Start microphone monitoring
    const startMonitoring = useCallback(async () => {
        try {
            const constraints: MediaStreamConstraints = {
                audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
                video: false
            };

            streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
            setHasPermission(true);
            setIsActive(true);

            // Set up audio analysis
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 512;
            source.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

            const checkLevel = () => {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const level = Math.min(100, (average / 128) * 100);
                setCurrentLevel(level);

                animationFrameRef.current = requestAnimationFrame(checkLevel);
            };

            checkLevel();
        } catch (error) {
            console.error('Failed to start mic monitoring:', error);
            setHasPermission(false);
        }
    }, [selectedDeviceId]);

    // Stop monitoring
    const stopMonitoring = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        analyserRef.current = null;
        setIsActive(false);
        setCurrentLevel(0);
    }, []);

    // Auto-start monitoring when permission is granted
    useEffect(() => {
        if (hasPermission === true && !isActive) {
            startMonitoring();
        }

        return () => {
            stopMonitoring();
        };
    }, [hasPermission, startMonitoring, stopMonitoring]);

    // Restart monitoring when device changes
    useEffect(() => {
        if (isActive && selectedDeviceId) {
            stopMonitoring();
            startMonitoring();
        }
    }, [selectedDeviceId]);

    const handleRequestPermission = async () => {
        await startMonitoring();
    };

    // Custom slider handling
    const handleSliderMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        updateSliderValue(e);
    };

    const handleSliderClick = (e: React.MouseEvent) => {
        updateSliderValue(e);
    };

    const updateSliderValue = (e: React.MouseEvent | MouseEvent) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setMicrophoneThreshold(Math.round(percentage));
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                updateSliderValue(e);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div className="pt-6 border-t theme-border">
            <h2 className="text-xl font-semibold theme-text-primary mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {t('voip.voiceAudio') || 'Voice & Audio'}
            </h2>
            <p className="text-sm theme-text-secondary mb-6">
                {t('voip.voiceAudioDescription') || 'Configure your microphone settings for voice calls.'}
            </p>

            {/* Permission Warning */}
            {hasPermission === false && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start">
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                {t('voip.microphonePermissionRequired') || 'Microphone Permission Required'}
                            </h4>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                {t('voip.microphonePermissionDesc') || 'Please allow microphone access to use voice features.'}
                            </p>
                            <button
                                onClick={handleRequestPermission}
                                className="mt-2 px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                            >
                                {t('voip.grantPermission') || 'Grant Permission'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* Input Device Selection */}
                <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">
                        {t('voip.inputDevice') || 'Input Device'}
                    </label>
                    <select
                        value={selectedDeviceId}
                        onChange={(e) => selectMicrophoneDevice(e.target.value)}
                        className="w-full px-4 py-2 theme-bg-tertiary theme-border border rounded-lg theme-text-primary"
                        disabled={availableDevices.length === 0}
                    >
                        <option value="">{t('voip.defaultMicrophone') || 'Default Microphone'}</option>
                        {availableDevices
                            // Filter out Communications and Default duplicates, keep only unique physical devices
                            .filter(device => {
                                const label = device.label.toLowerCase();
                                // Skip entries that are just "Default" or "Communications" variations
                                return !label.startsWith('default') &&
                                    !label.startsWith('communications') &&
                                    !label.startsWith('predefinição') &&
                                    !label.startsWith('comunicações') &&
                                    !label.startsWith('microfone predefinido');
                            })
                            // Remove duplicates by device label (same physical device)
                            .filter((device, index, self) =>
                                index === self.findIndex(d => d.label === device.label)
                            )
                            .map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                </option>
                            ))}
                    </select>
                </div>

                {/* Merged Input Sensitivity & Level Meter */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium theme-text-primary">
                            {t('voip.inputSensitivity') || 'Input Sensitivity'}
                        </label>
                        <span className="text-sm font-mono theme-text-muted">
                            {Math.round(currentLevel)}%
                        </span>
                    </div>

                    {/* Combined Level Meter with Draggable Threshold */}
                    <div
                        ref={sliderRef}
                        className="relative h-10 theme-bg-tertiary rounded-lg overflow-hidden cursor-pointer select-none"
                        onMouseDown={handleSliderMouseDown}
                        onClick={handleSliderClick}
                    >
                        {/* Level bars */}
                        <div className="absolute inset-0 flex items-center px-1 gap-0.5">
                            {Array.from({ length: 50 }).map((_, i) => {
                                const barPercent = (i / 50) * 100;
                                const isActive = barPercent < currentLevel;
                                const isBelowThreshold = barPercent < microphoneThreshold;

                                return (
                                    <div
                                        key={i}
                                        className={`flex-1 rounded-sm transition-colors duration-50 ${isActive
                                            ? isBelowThreshold
                                                ? 'bg-gray-500' // Below threshold - muted
                                                : i < 35 ? 'bg-green-500' : i < 45 ? 'bg-yellow-500' : 'bg-red-500'
                                            : 'bg-gray-700'
                                            }`}
                                        style={{ height: '70%' }}
                                    />
                                );
                            })}
                        </div>

                        {/* Threshold handle - dark gray with rounded corners */}
                        <div
                            className="absolute top-1 bottom-1 w-3 bg-gray-600 rounded cursor-ew-resize z-10 shadow-lg"
                            style={{ left: `calc(${microphoneThreshold}% - 6px)` }}
                        >
                            {/* Handle grip lines */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                <div className="w-0.5 h-1.5 bg-gray-400 rounded-full"></div>
                                <div className="w-0.5 h-1.5 bg-gray-400 rounded-full"></div>
                                <div className="w-0.5 h-1.5 bg-gray-400 rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    {/* Threshold indicator below slider */}
                    <div className="flex justify-end mt-1">
                        <span className="text-xs theme-text-secondary">
                            {t('voip.threshold') || 'Threshold'}: {microphoneThreshold}%
                        </span>
                    </div>

                    <p className="text-xs theme-text-muted mt-2">
                        {t('voip.inputSensitivityDesc') || 'Drag the white bar to set threshold. Audio below it will not be transmitted.'}
                    </p>

                    {/* Status indicator */}
                    {hasPermission !== false && (
                        <div className="flex items-center gap-2 mt-2">
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                            <span className="text-xs theme-text-muted">
                                {isActive
                                    ? (t('voip.microphoneActive') || 'Microphone active - speak to test')
                                    : (t('voip.microphoneInactive') || 'Microphone inactive')
                                }
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoipAudioSettings;

