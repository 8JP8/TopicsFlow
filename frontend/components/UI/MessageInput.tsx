import React, { useRef, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Paperclip, Image as ImageIcon, Send, Mic, Trash2, X } from 'lucide-react';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import AudioPlayer from '@/components/UI/AudioPlayer';

interface MessageInputProps {
    // Input State
    value: string;
    onChange: (value: string) => void;
    onSend: (e?: React.FormEvent) => void;
    isLoading?: boolean;
    placeholder?: string;

    // Attachments
    selectedGifUrl?: string | null;
    onRemoveGif?: () => void;
    selectedFiles?: File[];
    onFileSelect?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveFile?: (index: number) => void;

    // Audio Recording
    isRecording?: boolean;
    recordingDuration?: number;
    audioBlob?: Blob | null;
    audioStream?: MediaStream | null; // New prop for visualization
    onStartRecording?: () => void;
    onStopRecording?: () => void;
    onCancelRecording?: () => void;
    onRemoveAudio?: () => void;

    // UI Actions
    onGifClick?: () => void;
    showGifPicker?: boolean;

    // Additional Content
    children?: React.ReactNode;
}

const MessageInput: React.FC<MessageInputProps> = ({
    value,
    onChange,
    onSend,
    isLoading = false,
    placeholder,
    selectedGifUrl,
    onRemoveGif,
    selectedFiles = [],
    onFileSelect,
    onRemoveFile,
    isRecording = false,
    recordingDuration = 0,
    audioBlob,
    audioStream,
    onStartRecording,
    onStopRecording,
    onRemoveAudio,
    onGifClick,
    showGifPicker,
    children
}) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [audioData, setAudioData] = useState<number[]>(new Array(20).fill(10)); // Initial low levels
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number>();
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Audio Visualization Effect
    useEffect(() => {
        if (isRecording && audioStream) {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            const ctx = audioContextRef.current;

            // Resume context if suspended (browser autoplay policy)
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64; // Small size for fewer bars
            analyser.smoothingTimeConstant = 0.5;
            analyserRef.current = analyser;

            try {
                const source = ctx.createMediaStreamSource(audioStream);
                source.connect(analyser);
                sourceRef.current = source;
            } catch (err) {
                console.error("Error creating media stream source:", err);
                return;
            }

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateWaveform = () => {
                if (!isRecording) return;

                analyser.getByteFrequencyData(dataArray);

                // Downsample to 20 bars
                const bars = 20;
                const step = Math.floor(bufferLength / bars);
                const newData = [];

                for (let i = 0; i < bars; i++) {
                    let sum = 0;
                    for (let j = 0; j < step; j++) {
                        sum += dataArray[i * step + j];
                    }
                    const avg = sum / step;
                    // Normalize to percentage (10-100)
                    newData.push(Math.max(10, (avg / 255) * 100));
                }

                setAudioData(newData);
                animationFrameRef.current = requestAnimationFrame(updateWaveform);
            };

            updateWaveform();

            return () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                if (sourceRef.current) {
                    sourceRef.current.disconnect();
                    sourceRef.current = null;
                }
                // Don't close AudioContext as it might be expensive to recreate, or do close it?
                // Better to keep it or handle cleanup in parent. 
                // For this component, we can probably leave it, but disconnecting source is key.
            };
        } else {
            // Reset visualization when not recording
            setAudioData(new Array(20).fill(10));
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }
    }, [isRecording, audioStream]);


    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
        }
    }, [value]);

    const canSend = value.trim() || selectedGifUrl || selectedFiles.length > 0 || audioBlob;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if (canSend) {
                e.preventDefault();
                onSend();
            }
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };



    return (
        <div className="border-t theme-border p-2 bg-white dark:theme-bg-secondary w-full">
            {/* Previews (Audio, Files) - Compact above input */}
            {(audioBlob || selectedFiles.length > 0 || selectedGifUrl) && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1 px-1">
                    {/* AUDIO PREVIEW - Enlarged */}
                    {audioBlob && (
                        <div className="flex items-center gap-3 px-3 py-2 border border-blue-200 dark:border-blue-900 rounded-xl bg-blue-50 dark:bg-blue-900/20 w-full max-w-md shadow-sm">
                            <div className="flex-1 min-w-0">
                                <AudioPlayer src={URL.createObjectURL(audioBlob)} className="w-full bg-transparent" />
                            </div>
                            <button
                                type="button"
                                onClick={onRemoveAudio}
                                className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* File Preview */}
                    {selectedFiles.map((file, idx) => (
                        <div key={`file-${idx}`} className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-900 min-w-fit">
                            <span className="truncate max-w-[100px] text-xs">{file.name}</span>
                            <button
                                type="button"
                                onClick={() => onRemoveFile && onRemoveFile(idx)}
                                className="text-red-500 hover:text-red-700 ml-1"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {/* GIF Preview */}
                    {selectedGifUrl && (
                        <div className="relative inline-block h-24 w-fit">
                            <img src={selectedGifUrl} alt="Selected GIF" className="h-full rounded-lg border theme-border shadow-sm" />
                            <button
                                type="button"
                                onClick={onRemoveGif}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-end gap-2">
                {/* Left Actions - Hidden when recording */}
                {!isRecording && (
                    <div className="flex items-center gap-1 mb-1">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={onFileSelect}
                            multiple
                            className="hidden"
                            accept="image/*,video/*,*/*"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title={t('common.attachFile') || 'Attach file'}
                        >
                            <Paperclip size={20} />
                        </button>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={onGifClick}
                                className={`p-2 transition-colors ${showGifPicker ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                title="GIF"
                            >
                                <ImageIcon size={20} />
                            </button>
                            {/* GIF Picker Container - Forced Right */}
                            {showGifPicker && (
                                <div className="absolute left-full bottom-0 ml-2 z-50">
                                    {children}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className={`flex-1 min-w-0 bg-gray-100 dark:theme-bg-tertiary rounded-3xl flex items-center px-4 py-2 border border-transparent focus-within:border-blue-500/30 transition-all ${isRecording ? 'justify-center' : ''}`}>
                    {isRecording ? (
                        <div className="flex-1 flex items-center justify-between gap-3 h-[40px]">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="font-mono text-red-500 text-base font-semibold tabular-nums">
                                    {formatTime(recordingDuration)}
                                </span>
                            </div>

                            {/* flexible waveform */}
                            <div className="flex items-center gap-0.5 h-8 mx-2 flex-1 w-full min-w-0 justify-center">
                                {audioData.map((height, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 max-w-[6px] bg-red-500 rounded-full transition-all duration-75 ease-linear"
                                        style={{
                                            height: `${height}%`,
                                            opacity: isRecording ? 1 : 0.5,
                                        }}
                                    />
                                ))}
                            </div>

                            <span className="text-sm text-gray-500 font-medium hidden md:inline-block whitespace-nowrap">
                                {t('chat.recording') || 'Recording...'}
                            </span>
                        </div>
                    ) : (
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                                onChange(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder || t('privateMessages.typeMessage')}
                            className="w-full bg-transparent border-none focus:ring-0 theme-text-primary placeholder-theme-text-muted px-0 py-1 shadow-none resize-none min-h-[24px] max-h-[120px] text-sm leading-relaxed overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
                            disabled={isLoading}
                            rows={1}
                        />
                    )}
                </div>

                {/* Right Actions */}
                <div className="mb-0.5">
                    {canSend ? (
                        <button
                            type="button"
                            onClick={(e) => onSend(e)}
                            disabled={isLoading}
                            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition-all disabled:opacity-50 hover:scale-105 active:scale-95 flex items-center justify-center"
                            title={t('common.send')}
                        >
                            {isLoading ? <LoadingSpinner size="sm" /> : <Send size={18} className="translate-x-0.2 translate-y-0.5" />}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={isRecording ? onStopRecording : onStartRecording}
                            className={`p-3 rounded-full shadow-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${isRecording
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30'
                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                                }`}
                            title={isRecording ? t('chat.stopRecording') || 'Stop' : t('chat.recordAudio') || 'Record Audio'}
                        >
                            {isRecording ? (
                                <div className="w-3 h-3 bg-white rounded-sm" />
                            ) : (
                                <Mic size={20} />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageInput;
