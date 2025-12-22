import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContextMenu from './ContextMenu';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  filename?: string;
  onShare?: (url: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  className = '',
  autoPlay = false,
  controls = true,
  filename,
  onShare,
}) => {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [uiDensity, setUiDensity] = useState<'normal' | 'compact' | 'tiny'>('normal');
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Adapt control sizes based on available height (DM/video embeds can be very short)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const h = entry?.contentRect?.height ?? el.getBoundingClientRect().height;

      // Tune thresholds to avoid overlap in cramped UI
      if (h < 180) setUiDensity('tiny');
      else if (h < 260) setUiDensity('compact');
      else setUiDensity('normal');
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename || 'video';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setContextMenu(null);
  };

  const handleShare = () => {
    if (onShare) {
      onShare(src);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(src).then(() => {
        // Could show a toast here
      });
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextMenuItems = [
    {
      label: t('common.download') || 'Download',
      action: handleDownload,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      label: t('common.share') || 'Share Link',
      action: handleShare,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
    },
  ];

  // If the caller doesn't provide an explicit height, prefer intrinsic aspect ratio
  // so the video doesn't consume unnecessary vertical space.
  const hasExplicitHeight =
    /(^|\s)h-/.test(className) ||
    /(^|\s)min-h-/.test(className) ||
    /(^|\s)max-h-/.test(className) ||
    className.includes('h[') ||
    className.includes('h-[');

  const overlayPadding =
    uiDensity === 'tiny'
      ? 'pt-3 pb-1 px-1.5'
      : uiDensity === 'compact'
        ? 'pt-4 pb-1.5 px-2'
        : 'pt-6 sm:pt-8 pb-2 sm:pb-3 px-2 sm:px-3';

  const playButtonPadding =
    uiDensity === 'tiny' ? 'p-1.5' : uiDensity === 'compact' ? 'p-2' : 'p-2 sm:p-3';

  const playIconSize =
    uiDensity === 'tiny' ? 'w-5 h-5' : uiDensity === 'compact' ? 'w-6 h-6' : 'w-6 h-6 sm:w-8 sm:h-8';

  const iconSize =
    uiDensity === 'tiny' ? 'w-3 h-3' : uiDensity === 'compact' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 sm:w-5 sm:h-5';

  const timeText =
    uiDensity === 'tiny'
      ? `${formatTime(currentTime)}`
      : `${formatTime(currentTime)}/${formatTime(duration)}`;

  const progressMargin =
    uiDensity === 'tiny' ? 'mb-2' : uiDensity === 'compact' ? 'mb-3' : 'mb-4';

  return (
    <div ref={containerRef} className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={`w-full ${hasExplicitHeight ? 'h-full' : 'h-auto'} object-contain`}
        onClick={togglePlay}
        onContextMenu={handleContextMenu}
      />

      {/* Controls Overlay */}
      {controls && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity group">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className={`opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-full ${playButtonPadding} text-white hover:bg-opacity-70`}
          >
            {isPlaying ? (
              <svg className={playIconSize} fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className={playIconSize} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Bottom Controls Bar */}
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/60 to-transparent ${overlayPadding} opacity-0 group-hover:opacity-100 transition-opacity`}>
            {/* Custom Progress Bar */}
            <div
              className={`relative w-full h-1 group/progress cursor-pointer ${progressMargin} flex items-center`}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, x / rect.width));
                if (videoRef.current) {
                  videoRef.current.currentTime = percentage * duration;
                  setCurrentTime(percentage * duration);
                }
              }}
              onMouseMove={(e) => {
                // Potential hover preview logic here
              }}
            >
              {/* Hit Area (Invisible but larger) */}
              <div className="absolute -top-2 -bottom-2 left-0 right-0" />

              {/* Background Track */}
              <div className="w-full h-1 group-hover/progress:h-2 bg-gray-600/60 rounded-full transition-all duration-200" />

              {/* Progress Fill */}
              <div
                className="absolute left-0 top-0 bottom-0 h-1 group-hover/progress:h-2 bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />

              {/* Thumb / Ball */}
              <div
                className="absolute h-3 w-3 bg-blue-500 rounded-full shadow transform scale-0 group-hover/progress:scale-100 transition-transform duration-200"
                style={{
                  left: `${(currentTime / duration) * 100}%`,
                  transform: `translateX(-50%) scale(${0})`, // Logic handled by CSS hover on group/progress
                }}
              >
                {/* Inner styling to be specific about the YouTube look */}
                <div className="w-full h-full bg-blue-500 rounded-full transform scale-0 group-hover/progress:scale-100 transition-transform" />
              </div>

              {/* Override transform for the thumb directly with class since inline style has issues with group-hover logic sometimes if not careful */}
              <style jsx>{`
                .group\\/progress:hover .thumb-ball {
                    transform: translateX(-50%) scale(1);
                }
                .thumb-ball {
                    transform: translateX(-50%) scale(0);
                }
              `}</style>
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-blue-500 rounded-full shadow thumb-ball transition-transform duration-200"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            {/* Time + Actions (responsive: stack on cramped layouts) */}
            <div className={`flex flex-col ${uiDensity === 'tiny' ? 'gap-1' : 'gap-2'} sm:flex-row sm:items-center sm:justify-between sm:gap-2 text-white`}>
              <span className={`font-medium whitespace-nowrap leading-none ${uiDensity === 'tiny' ? 'text-[10px]' : 'text-[10px] sm:text-xs'}`}>
                {timeText}
              </span>
              <div className={`flex items-center ${uiDensity === 'tiny' ? 'gap-1' : 'gap-1.5 sm:gap-3'} flex-shrink-0 self-end`}>
                <button
                  onClick={handleDownload}
                  className="hover:text-blue-400 transition-colors p-1.5 sm:p-0"
                  title={t('common.download') || 'Download'}
                >
                  <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="hover:text-blue-400 transition-colors"
                  title={t('common.fullscreen') || 'Fullscreen'}
                >
                  <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      )}
    </div>
  );
};

export default VideoPlayer;


