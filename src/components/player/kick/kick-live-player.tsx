import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { QualityLevel, PlayerError, Platform } from '../types';
import { HlsPlayer } from '../hls-player';
import { KickLivePlayerControls } from './kick-live-player-controls';
import { usePlayerKeyboard } from '../use-player-keyboard';
import { usePictureInPicture } from '../use-picture-in-picture';
import { useFullscreen } from '../use-fullscreen';
import { useResumePlayback } from '../use-resume-playback';
import { useDefaultQuality } from '../use-default-quality';
import { KickLoadingSpinner } from '@/components/ui/loading-spinner';

export interface KickLivePlayerProps {
    streamUrl: string;
    poster?: string;
    autoPlay?: boolean;
    muted?: boolean;
    quality?: QualityLevel;
    onReady?: () => void;
    onError?: (error: PlayerError) => void;
    onQualityChange?: (quality: QualityLevel) => void;
    className?: string;
    isTheater?: boolean;
    onToggleTheater?: () => void;
    // Stream identification for resume playback
    channelName?: string;
    title?: string;
    thumbnail?: string;
    startedAt?: string; // Stream start time for uptime calculation
}

export function KickLivePlayer(props: KickLivePlayerProps) {
    const {
        streamUrl,
        poster,
        autoPlay = false,
        muted: initialMuted = false,
        quality,
        onReady,
        onError,
        onQualityChange,
        className,
        isTheater,
        onToggleTheater,
        channelName,
        title,
        thumbnail,
        startedAt
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const volumePreferenceRef = useRef(100); // Preserve user's volume preference across stream changes

    // Hooks
    const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
    const { isPip, togglePip } = usePictureInPicture(videoRef);

    // Resume playback hook (for live streams with DVR)
    useResumePlayback({
        platform: 'kick' as Platform,
        videoId: channelName ? `live-${channelName}` : '',
        videoRef: videoRef as React.RefObject<HTMLVideoElement>,
        title: title || channelName,
        thumbnail,
        enabled: false // Disabled: Always start at live edge (no DVR support)
    });

    // State
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [availableQualities, setAvailableQualities] = useState<QualityLevel[]>([]);
    const [currentQualityId, setCurrentQualityId] = useState<string>('auto');
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState<TimeRanges | undefined>(undefined);
    const [seekableRange, setSeekableRange] = useState<{ start: number; end: number } | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [hasError, setHasError] = useState(false);

    // Apply user's default quality preference
    useDefaultQuality(availableQualities, currentQualityId, setCurrentQualityId);

    // Reset state when streamUrl changes (new stream)
    useEffect(() => {
        setHasError(false);
        setIsReady(false); // Reset ready state so initialization runs for new stream
    }, [streamUrl]);

    // Uptime Calculation Effect
    useEffect(() => {
        if (!startedAt || !isPlaying) return;

        const updateUptime = () => {
            const now = Date.now();
            const start = new Date(startedAt).getTime();
            const uptime = (now - start) / 1000;
            const video = videoRef.current;

            // Set duration to uptime (growing constantly)
            setDuration(uptime);

            if (hlsRef.current && hlsRef.current.playingDate) {
                // Precise absolute time from HLS Program Date Time
                const current = (hlsRef.current.playingDate.getTime() - start) / 1000;
                setCurrentTime(current);

                // Calculate seekable range in uptime coordinates
                if (video && video.seekable.length > 0) {
                    const seekableStartVideo = video.seekable.start(0);
                    const seekableEndVideo = video.seekable.end(video.seekable.length - 1);
                    const currentVideo = video.currentTime;

                    // Offset: currentUptime - currentVideoTime
                    const offset = current - currentVideo;

                    const calculatedStart = seekableStartVideo + offset;
                    const calculatedEnd = seekableEndVideo + offset;

                    setSeekableRange({
                        start: calculatedStart,
                        end: calculatedEnd
                    });
                }
            } else if (video && video.seekable.length > 0) {
                // Fallback: Estimate time based on "Live Edge" assumption
                // We assume video.seekable.end() is "Now" (uptime)
                const seekableEnd = video.seekable.end(video.seekable.length - 1);
                const secondsFromLive = seekableEnd - video.currentTime;
                const current = Math.max(0, uptime - secondsFromLive);
                setCurrentTime(current);

                // In this fallback model, seekable.end maps to uptime
                // So seekable.start maps to uptime - (seekable.end - seekable.start)
                const windowDuration = seekableEnd - video.seekable.start(0);
                const calculatedStart = Math.max(0, uptime - windowDuration);

                setSeekableRange({
                    start: calculatedStart,
                    end: uptime
                });
            }
        };

        const interval = setInterval(updateUptime, 250); // Higher frequency for smoother UI
        return () => clearInterval(interval);
    }, [startedAt, isPlaying]);

    // Setup event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleVolumeChange = () => {
            setIsMuted(video.muted);
            setVolume(video.volume * 100);
        };
        const handleWait = () => setIsLoading(true);
        const handlePlaying = () => setIsLoading(false);
        // We use the interval above for time updates when startedAt is present
        const handleTimeUpdate = () => {
            if (!startedAt) {
                setCurrentTime(video.currentTime);
            }
        };
        const handleDurationChange = () => {
            // For live streams, duration might be Infinity or a large number
            const dur = video.duration;
            if (!startedAt && isFinite(dur) && dur > 0) {
                setDuration(dur);
            }
        };
        const handleProgress = () => setBuffered(video.buffered);
        const handleRateChange = () => setPlaybackRate(video.playbackRate);

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('waiting', handleWait);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('progress', handleProgress);
        video.addEventListener('ratechange', handleRateChange);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('waiting', handleWait);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('progress', handleProgress);
            video.removeEventListener('ratechange', handleRateChange);
        };
    }, [isReady, startedAt]);

    // Keep volume preference ref in sync with state
    useEffect(() => {
        volumePreferenceRef.current = volume;
    }, [volume]);

    // Initialize volume/mute and sync React state
    // Triggered when isReady becomes true (video element is available)
    useEffect(() => {
        const video = videoRef.current;
        if (video && isReady) {
            video.muted = initialMuted;
            // Apply user's volume preference (defaults to 100 on first mount)
            video.volume = volumePreferenceRef.current / 100;
            // Sync React state to ensure UI reflects actual video state
            setIsMuted(video.muted);
            setVolume(video.volume * 100);
        }
    }, [initialMuted, isReady]);

    // Handlers
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch((e) => {
                // Ignore AbortError (interrupted by load) and NotAllowedError (autoplay policy)
                if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                    console.error('Play error:', e);
                }
            });
        } else {
            video.pause();
        }
    }, []);

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
    }, []);

    const togglePipHandler = useCallback(async () => {
        await togglePip();
    }, [togglePip]);

    const handleVolumeChange = useCallback((newVolume: number) => {
        const video = videoRef.current;
        if (!video) return;

        const vol = Math.max(0, Math.min(100, newVolume));
        video.volume = vol / 100;
        if (vol > 0 && video.muted) {
            video.muted = false;
        }
        if (vol === 0) {
            video.muted = true;
        }
    }, []);

    const handleSeek = useCallback((targetTime: number) => {
        const video = videoRef.current;
        if (!video) return;

        if (startedAt) {
            // Delta Seeking: Calculate difference from current UI time
            // usage: targetTime is "seconds since stream start"
            // currentTime is "seconds since stream start" (state)

            // We recalculate precise currentTime here just in case state is stale
            let currentStreamTime = currentTime;

            // If we have HLS playingDate, use it for base truth
            if (hlsRef.current && hlsRef.current.playingDate) {
                const start = new Date(startedAt).getTime();
                currentStreamTime = (hlsRef.current.playingDate.getTime() - start) / 1000;
            } else if (video.seekable.length > 0) {
                // Fallback calculations
                const now = Date.now();
                const start = new Date(startedAt).getTime();
                const uptime = (now - start) / 1000;
                const seekableEnd = video.seekable.end(video.seekable.length - 1);
                const secondsFromLive = seekableEnd - video.currentTime;
                currentStreamTime = uptime - secondsFromLive;
            }

            const diff = targetTime - currentStreamTime;
            let newTime = video.currentTime + diff;

            // Clamp to seekable, but allow a bit of buffer
            if (video.seekable.length > 0) {
                const start = video.seekable.start(0);
                const end = video.seekable.end(video.seekable.length - 1);

                if (newTime < start) {
                    newTime = start;
                }
                if (newTime > end) {
                    newTime = end;
                }
            }

            video.currentTime = newTime;
        } else {
            video.currentTime = targetTime;
        }
    }, [startedAt, currentTime]);

    const handlePlaybackRateChange = useCallback((rate: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = rate;
    }, []);

    const handleQualityLevels = useCallback((levels: QualityLevel[]) => {
        setAvailableQualities(levels);
        if (!isReady) {
            setIsReady(true);
            // Only stop loading immediately if we are NOT auto-playing
            // If auto-playing, wait for the actual 'playing' event to clear the spinner
            if (!autoPlay) {
                setIsLoading(false);
            }
            onReady?.();
        }
    }, [isReady, onReady, autoPlay]);

    const handleQualitySet = useCallback((id: string) => {
        setCurrentQualityId(id);
        if (onQualityChange) {
            const level = availableQualities.find(q => q.id === id);
            if (level) onQualityChange(level);
        }
    }, [availableQualities, onQualityChange]);

    const handleHlsInstance = useCallback((hls: Hls) => {
        hlsRef.current = hls;
    }, []);

    // Keyboard shortcuts
    usePlayerKeyboard({
        onTogglePlay: togglePlay,
        onToggleMute: toggleMute,
        onVolumeUp: () => handleVolumeChange(volume + 10),
        onVolumeDown: () => handleVolumeChange(volume - 10),
        onToggleFullscreen: toggleFullscreen,
        disabled: !isReady
    });

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full bg-black overflow-hidden group ${className || ''}`}
        >
            {streamUrl ? (
                <HlsPlayer
                    ref={videoRef}
                    src={streamUrl}
                    poster={poster}
                    muted={initialMuted}
                    autoPlay={autoPlay}
                    currentLevel={currentQualityId}
                    onQualityLevels={handleQualityLevels}
                    onError={(error) => {
                        console.error('[KickPlayer] Player error:', error);
                        setHasError(true);
                        setIsLoading(false);
                        onError?.(error);
                    }}
                    onHlsInstance={handleHlsInstance}
                    className="size-full object-contain cursor-pointer"
                    controls={false}
                    onDoubleClick={toggleFullscreen}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white z-0">
                    <p>No Stream Source</p>
                </div>
            )}

            {/* Centered Loading Spinner - Kick Green */}
            {isLoading && streamUrl && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <KickLoadingSpinner />
                </div>
            )}

            {/* Controls Overlay - Live stream with DVR progress bar */}
            {streamUrl && !hasError && (
                <KickLivePlayerControls
                    isPlaying={isPlaying}
                    isLoading={isLoading}
                    volume={volume}
                    muted={isMuted}
                    qualities={availableQualities}
                    currentQualityId={currentQualityId}
                    isFullscreen={isFullscreen}
                    onTogglePlay={togglePlay}
                    onToggleMute={toggleMute}
                    onVolumeChange={handleVolumeChange}
                    onQualityChange={handleQualitySet}
                    onToggleFullscreen={toggleFullscreen}
                    onToggleTheater={onToggleTheater}
                    isTheater={isTheater}
                    onTogglePip={togglePipHandler}
                    currentTime={currentTime}
                    duration={duration}
                    seekableRange={seekableRange}
                    onSeek={handleSeek}
                    buffered={buffered}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={handlePlaybackRateChange}
                />
            )}
        </div>
    );
}
