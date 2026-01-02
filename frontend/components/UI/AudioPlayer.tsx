import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import ContextMenu from './ContextMenu';
import { useLanguage } from '@/contexts/LanguageContext';
import AudioPlayerModal from './AudioPlayerModal';

interface AudioPlayerProps {
    src: string;
    className?: string;
    filename?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className = '', filename }) => {
    const { t } = useLanguage();
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Generate dynamic bars based on width
    const [bars, setBars] = useState<number[]>([]);

    useEffect(() => {
        const updateBars = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                // Make bars dense: e.g., 3px per bar (2px width + 1px gap)
                const barWidth = 3;
                const count = Math.floor(width / barWidth);
                setBars(Array.from({ length: count }).map(() => Math.max(20, Math.random() * 100)));
            }
        };

        const observer = new ResizeObserver(updateBars);
        if (containerRef.current) {
            observer.observe(containerRef.current);
            updateBars(); // Initial call
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => {
            setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };

        const setAudioTime = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            audio.currentTime = 0;
        };

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const time = Number(e.target.value);
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = src;
        link.download = filename || 'audio_file.webm';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const progress = duration ? currentTime / duration : 0;

    return (
        <>
            <div
                className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-100 dark:bg-gray-800/80 rounded-xl w-full max-w-full overflow-hidden ${className}`}
                onContextMenu={handleContextMenu}
            >
                <audio ref={audioRef} src={src} preload="metadata" />

                <button
                    onClick={togglePlay}
                    className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors flex-shrink-0"
                >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0 relative flex flex-col justify-center gap-1" ref={containerRef}>
                    {/* SVG Waveform Visualization */}
                    <div className="relative h-6 w-full">
                        <svg
                            className="w-full h-full text-gray-400 dark:text-gray-500"
                            preserveAspectRatio="none"
                            viewBox={`0 0 ${bars.length * 3} 100`}
                        >
                            <defs>
                                <clipPath id={`progress-${src}`}>
                                    <rect x="0" y="0" width={(bars.length * 3) * progress} height="100" />
                                </clipPath>
                            </defs>

                            {/* Background Bars */}
                            <g className="opacity-40">
                                {bars.map((height, i) => (
                                    <rect
                                        key={i}
                                        x={i * 3}
                                        y={100 - height}
                                        width="1.5"
                                        height={height}
                                        fill="currentColor"
                                        rx="1"
                                    />
                                ))}
                            </g>

                            {/* Foreground Bars (Progress) */}
                            <g clipPath={`url(#progress-${src})`} className="text-blue-500">
                                {bars.map((height, i) => (
                                    <rect
                                        key={i}
                                        x={i * 3}
                                        y={100 - height}
                                        width="1.5"
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
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            title="Seek"
                        />
                    </div>

                    {/* Timestamps */}
                    <div className="flex justify-between text-[10px] text-gray-500 font-medium select-none w-full">
                        <span className="truncate">{formatTime(currentTime)}</span>
                        <span className="truncate">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <button
                        onClick={toggleMute}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1"
                    >
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1"
                        title={t('common.open') || "Open"}
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            </div>

            {contextMenu && (
                <ContextMenu
                    items={[
                        {
                            label: t('common.download') || 'Download',
                            action: handleDownload,
                        },
                        {
                            label: t('common.open') || 'Open in Big Player',
                            action: () => setIsModalOpen(true),
                        }
                    ]}
                    onClose={() => setContextMenu(null)}
                    x={contextMenu.x}
                    y={contextMenu.y}
                />
            )}

            <AudioPlayerModal
                src={src}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                filename={filename}
            />
        </>
    );
};

export default AudioPlayer;
