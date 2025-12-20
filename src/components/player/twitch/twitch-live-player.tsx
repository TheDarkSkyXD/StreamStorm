import React, { useRef, useState, useEffect, useCallback } from 'react';
import { QualityLevel, PlayerError, Platform } from '../types';
import { HlsPlayer } from '../hls-player';
import { TwitchLivePlayerControls } from './twitch-live-player-controls';
import { usePlayerKeyboard } from '../use-player-keyboard';
import { usePictureInPicture } from '../use-picture-in-picture';
import { useFullscreen } from '../use-fullscreen';
import { useDefaultQuality } from '../use-default-quality';
import { TwitchLoadingSpinner } from '@/components/ui/loading-spinner';

export interface TwitchLivePlayerProps {
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
}

export function TwitchLivePlayer(props: TwitchLivePlayerProps) {
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
        onToggleTheater
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const volumePreferenceRef = useRef(100); // Preserve user's volume preference across stream changes

    // Hooks
    const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
    const { isPip, togglePip } = usePictureInPicture(videoRef);

    // State
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [availableQualities, setAvailableQualities] = useState<QualityLevel[]>([]);
    const [currentQualityId, setCurrentQualityId] = useState<string>('auto');
    const [isLoading, setIsLoading] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [hasError, setHasError] = useState(false);

    // Apply user's default quality preference
    useDefaultQuality(availableQualities, currentQualityId, setCurrentQualityId);

    // Reset state when streamUrl changes (new stream)
    useEffect(() => {
        setHasError(false);
        setIsReady(false); // Reset ready state so initialization runs for new stream
    }, [streamUrl]);

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
        const handleWaiting = () => setIsLoading(true);
        const handlePlaying = () => setIsLoading(false);
        const handleRateChange = () => setPlaybackRate(video.playbackRate);

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ratechange', handleRateChange);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ratechange', handleRateChange);
        };
    }, [isReady]);

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

    const handlePlaybackRateChange = useCallback((rate: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = rate;
    }, []);

    const handleQualityLevels = useCallback((levels: QualityLevel[]) => {
        setAvailableQualities(levels);
        if (!isReady) {
            setIsReady(true);
            setIsLoading(false);
            onReady?.();
        }
    }, [isReady, onReady]);

    const handleQualitySet = useCallback((id: string) => {
        setCurrentQualityId(id);
        if (onQualityChange) {
            const level = availableQualities.find(q => q.id === id);
            if (level) onQualityChange(level);
        }
    }, [availableQualities, onQualityChange]);

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
                        console.error('[TwitchPlayer] Player error:', error);
                        setHasError(true);
                        setIsLoading(false);
                        onError?.(error);
                    }}
                    className="size-full object-contain cursor-pointer"
                    controls={false}
                    onDoubleClick={toggleFullscreen}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white z-0">
                    <p>No Stream Source</p>
                </div>
            )}

            {/* Centered Loading Spinner - Twitch Purple */}
            {isLoading && streamUrl && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <TwitchLoadingSpinner />
                </div>
            )}

            {/* Controls Overlay - Live stream (no progress bar) */}
            {streamUrl && !hasError && (
                <TwitchLivePlayerControls
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
                    playbackRate={playbackRate}
                    onPlaybackRateChange={handlePlaybackRateChange}
                />
            )}
        </div>
    );
}
