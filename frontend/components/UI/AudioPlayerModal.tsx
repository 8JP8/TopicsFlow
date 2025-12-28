import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Download, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AudioPlayerModalProps {
    src: string;
    isOpen: boolean;
    onClose: () => void;
    filename?: string;
}

const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({ src, isOpen, onClose, filename }) => {
    const { t } = useLanguage();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const rafRef = useRef<number>();

    // Generate stable random bars for waveform
    const bars = React.useMemo(() =>
        Array.from({ length: 60 }).map(() => Math.max(20, Math.random() * 100)),
        []);

    const updateProgress = () => {
        if (audioRef.current && !isDragging) {
            setCurrentTime(audioRef.current.currentTime);
            rafRef.current = requestAnimationFrame(updateProgress);
        }
    };

    useEffect(() => {
        if (isPlaying && !isDragging) {
            rafRef.current = requestAnimationFrame(updateProgress);
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying, isDragging]);

    useEffect(() => {
        if (isOpen && audioRef.current) {
            // Reset state on open
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
            setIsPlaying(true);
            audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
        } else if (!isOpen && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }, [isOpen]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateDuration = () => setDuration(audio.duration);
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        const onPause = () => setIsPlaying(false);
        const onPlay = () => setIsPlaying(true);
        const onCanPlay = () => {
            if (isOpen && !isPlaying) {
                audio.play().catch(e => console.error("Auto-play failed:", e));
            }
        };

        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('canplay', onCanPlay);

        return () => {
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('canplay', onCanPlay);
        };
    }, [isOpen]); // Added isOpen dependency to re-bind if needed, actually isOpen is used in onCanPlay closure

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleSeekStart = () => {
        setIsDragging(true);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    const handleSeekEnd = () => {
        setIsDragging(false);
        if (audioRef.current && isPlaying) {
            // Ensure loop restarts if needed, though dependency on isDragging handles it
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
            setIsMuted(newVolume === 0);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = src;
        link.download = filename || 'audio_file.webm';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 flex flex-col gap-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
                    <h3 className="text-lg font-semibold truncate theme-text-primary">
                        {filename || t('chat.audioMessage')}
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title={t('common.download') || 'Download'}
                        >
                            <Download className="w-5 h-5 theme-text-secondary" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title={t('common.close') || 'Close'}
                        >
                            <X className="w-6 h-6 theme-text-secondary" />
                        </button>
                    </div>
                </div>

                {/* Visualization (Big Waveform & Scrubber) */}
                <div className="flex-1 min-h-[120px] flex flex-col justify-center gap-4">
                    <div className="relative w-full h-32 group">
                        <svg
                            className="w-full h-full text-gray-300 dark:text-gray-700"
                            preserveAspectRatio="none"
                            viewBox="0 0 100 100"
                        >
                            <defs>
                                <clipPath id={`modal-progress-${src}`}>
                                    <rect x="0" y="0" width={duration ? (currentTime / duration) * 100 : 0} height="100" />
                                </clipPath>
                            </defs>

                            {/* Background Bars */}
                            <g className="opacity-50">
                                {bars.map((height, i) => (
                                    <rect
                                        key={i}
                                        x={i * 1.66} // 60 bars spread across 100 width (100/60 ~= 1.66)
                                        y={100 - height}
                                        width="1.2"
                                        height={height}
                                        fill="currentColor"
                                        rx="1"
                                    />
                                ))}
                            </g>

                            {/* Foreground Bars (Progress) */}
                            <g clipPath={`url(#modal-progress-${src})`} className="text-blue-500">
                                {bars.map((height, i) => (
                                    <rect
                                        key={i}
                                        x={i * 1.66}
                                        y={100 - height}
                                        width="1.2"
                                        height={height}
                                        fill="currentColor"
                                        rx="1"
                                    />
                                ))}
                            </g>
                        </svg>

                        {/* Scrubbing Input */}
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step="0.01"
                            value={currentTime}
                            onChange={handleSeek}
                            onMouseDown={handleSeekStart}
                            onTouchStart={handleSeekStart}
                            onMouseUp={handleSeekEnd}
                            onTouchEnd={handleSeekEnd}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            title="Seek"
                        />
                    </div>

                    {/* Timestamps */}
                    <div className="flex justify-between text-sm text-gray-500 font-mono px-1">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-2 pb-2">
                    {/* Buttons */}
                    <div className="flex items-center justify-center gap-6 relative">
                        {/* Play/Pause (Center) */}
                        <button
                            onClick={togglePlay}
                            className="w-20 h-20 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                        >
                            {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                        </button>

                        {/* Volume Control (Right Side) */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
                            <button
                                onClick={toggleMute}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-24 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <audio ref={audioRef} src={src} className="hidden" />
            </div>
            {/* Backdrop click to close */}
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
};

export default AudioPlayerModal;
