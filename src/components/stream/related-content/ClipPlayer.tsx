import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Maximize, Minimize, Volume2, Volume1, VolumeX } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { ClipPlayerProps } from './types';

/**
 * Custom clip player component with volume control on the left
 * Supports both HLS (.m3u8) and MP4 streams
 */
export function ClipPlayer({ src, autoPlay = false, onError }: ClipPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const volumeSliderRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [volume, setVolume] = useState(100);
    const [muted, setMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isDraggingVolume, setIsDraggingVolume] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout>(null);

    // Initialize HLS or native video
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        let hls: Hls | null = null;
        const isHls = src.includes('.m3u8');

        console.log('[ClipPlayer] Loading source:', src, 'isHLS:', isHls);

        if (isHls && Hls.isSupported()) {
            // Use HLS.js for HLS streams
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false, // Clips don't need low latency
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                manifestLoadingMaxRetry: 3,
                manifestLoadingRetryDelay: 2000,
                levelLoadingMaxRetry: 3,
                levelLoadingRetryDelay: 2000,
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: 2000,
                xhrSetup: (xhr, url) => {
                    xhr.withCredentials = false;
                },
            });
            hlsRef.current = hls;

            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[ClipPlayer] HLS manifest parsed, ready to play');
                setIsReady(true);
                if (autoPlay) {
                    video.play().catch(e => console.warn('[ClipPlayer] Autoplay failed:', e));
                }
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('[ClipPlayer] HLS error:', data.type, data.details, data.fatal);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('[ClipPlayer] Fatal network error');
                            onError?.();
                            hls?.destroy();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('[ClipPlayer] Trying to recover from media error');
                            hls?.recoverMediaError();
                            break;
                        default:
                            console.error('[ClipPlayer] Unrecoverable error');
                            onError?.();
                            hls?.destroy();
                            break;
                    }
                }
            });

        } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            console.log('[ClipPlayer] Using native HLS');
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                setIsReady(true);
                if (autoPlay) video.play().catch(console.error);
            });
            video.addEventListener('error', () => onError?.());
        } else {
            // MP4 or other native formats
            console.log('[ClipPlayer] Using native video playback');
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                setIsReady(true);
                if (autoPlay) video.play().catch(console.error);
            });
            video.addEventListener('error', () => onError?.());
        }

        return () => {
            if (hls) {
                console.log('[ClipPlayer] Destroying HLS instance');
                hls.destroy();
            }
            hlsRef.current = null;
        };
    }, [src, autoPlay, onError]);

    // Handle play/pause
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(console.error);
        } else {
            video.pause();
        }
    }, []);

    // Handle volume change
    const handleVolumeChange = useCallback((newVolume: number) => {
        const video = videoRef.current;
        if (!video) return;
        const clampedVolume = Math.max(0, Math.min(100, newVolume));
        setVolume(clampedVolume);
        video.volume = clampedVolume / 100;
        if (clampedVolume > 0 && muted) {
            setMuted(false);
            video.muted = false;
        }
    }, [muted]);

    // Handle mute toggle
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setMuted(video.muted);
    }, []);

    // Handle seek
    const handleSeek = useCallback((time: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = time;
    }, []);

    // Handle fullscreen
    const toggleFullscreen = useCallback(async () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            await containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            await document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onDurationChange = () => setDuration(video.duration);
        const onVolumeChange = () => {
            setVolume(video.volume * 100);
            setMuted(video.muted);
        };

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('volumechange', onVolumeChange);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('volumechange', onVolumeChange);
        };
    }, []);

    // Auto-hide controls
    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            if (isPlaying) {
                hideTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('mousemove', handleMouseMove);
            return () => container.removeEventListener('mousemove', handleMouseMove);
        }
    }, [isPlaying]);

    // Get volume icon
    const getVolumeIcon = () => {
        if (muted || volume === 0) return <VolumeX className="w-5 h-5" />;
        if (volume < 50) return <Volume1 className="w-5 h-5" />;
        return <Volume2 className="w-5 h-5" />;
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black group"
            onClick={togglePlay}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
            />

            {/* Loading indicator */}
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
                </div>
            )}

            {/* Custom Controls */}
            <div
                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent pt-12 pb-3 px-4 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress Bar */}
                <div className="w-full mb-2">
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={(e) => handleSeek(Number(e.target.value))}
                        className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-between">
                    {/* Left: Play + Volume */}
                    <div className="flex items-center gap-3">
                        {/* Play/Pause Button */}
                        <button
                            className="text-white hover:text-white/80 transition-colors"
                            onClick={togglePlay}
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6 fill-white" />
                            ) : (
                                <Play className="w-6 h-6 fill-white" />
                            )}
                        </button>

                        {/* Volume Control - ON THE LEFT */}
                        <div className="flex items-center gap-2 group/volume">
                            <button
                                className="text-white hover:text-white/80 transition-colors"
                                onClick={toggleMute}
                            >
                                {getVolumeIcon()}
                            </button>
                            <div className={`overflow-hidden transition-all duration-200 flex items-center ${isDraggingVolume ? 'w-20' : 'w-0 group-hover/volume:w-20'}`}>
                                {/* Custom slider with visible thumb and drag support */}
                                <div
                                    ref={volumeSliderRef}
                                    className="relative w-full h-4 flex items-center cursor-pointer select-none"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setIsDraggingVolume(true);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                                        handleVolumeChange(percent);

                                        const handleMouseMove = (moveEvent: MouseEvent) => {
                                            const movePercent = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
                                            handleVolumeChange(movePercent);
                                        };

                                        const handleMouseUp = () => {
                                            setIsDraggingVolume(false);
                                            document.removeEventListener('mousemove', handleMouseMove);
                                            document.removeEventListener('mouseup', handleMouseUp);
                                        };

                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                >
                                    {/* Track background */}
                                    <div className="absolute w-full h-1 bg-white/30 rounded-full" />
                                    {/* Filled track */}
                                    <div
                                        className="absolute h-1 bg-white rounded-full"
                                        style={{ width: `${muted ? 0 : volume}%` }}
                                    />
                                    {/* Thumb (white circle) - positioned to stay within bounds */}
                                    <div
                                        className="absolute w-3 h-3 bg-white rounded-full shadow-md cursor-pointer"
                                        style={{
                                            left: `calc(${(muted ? 0 : volume) / 100} * (100% - 12px))`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Time Display */}
                        <div className="text-white text-xs font-mono select-none">
                            {formatDuration(currentTime)} / {formatDuration(duration)}
                        </div>
                    </div>

                    {/* Right: Fullscreen */}
                    <div className="flex items-center gap-2">
                        <button
                            className="text-white hover:text-white/80 transition-colors"
                            onClick={toggleFullscreen}
                        >
                            {isFullscreen ? (
                                <Minimize className="w-5 h-5" />
                            ) : (
                                <Maximize className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
