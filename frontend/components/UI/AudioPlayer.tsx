import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
    src: string;
    className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className = '' }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

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

        // Events
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

    return (
        <div className={`flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-xl max-w-sm ${className}`}>
            <audio ref={audioRef} src={src} preload="metadata" />

            <button
                onClick={togglePlay}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors flex-shrink-0"
            >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>

            <div className="flex-1 min-w-0">
                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            <button
                onClick={toggleMute}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
        </div>
    );
};

export default AudioPlayer;
