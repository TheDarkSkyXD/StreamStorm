import React, { useRef, useState, useEffect, useCallback } from 'react';
import { QualityLevel, PlayerError, Platform } from '../types';
import { HlsPlayer, HlsPlayerHandle } from '../hls-player';
import { TwitchLivePlayerControls } from './twitch-live-player-controls';
import { usePlayerKeyboard } from '../use-player-keyboard';
import { usePictureInPicture } from '../use-picture-in-picture';
import { useFullscreen } from '../use-fullscreen';
import { useDefaultQuality } from '../use-default-quality';
import { useVolume } from '../useVolume';
import { TwitchLoadingSpinner } from '@/components/ui/loading-spinner';
import { useAdBlock } from '@/hooks/useAdBlock';
import { AdBlockOverlay } from '../AdBlockOverlay';

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
    channelName?: string;
    /** Callback when ads are detected (for dynamic proxy switching) */
    onAdDetected?: () => void;
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
        onToggleTheater,
        channelName,
        onAdDetected
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const hlsPlayerRef = useRef<HlsPlayerHandle>(null);
    // Standard video element ref
    const videoRef = useRef<HTMLVideoElement>(null);

    // Persistent volume
    const { volume, isMuted, handleVolumeChange, handleToggleMute, syncFromVideoElement } = useVolume({
        videoRef: videoRef as React.RefObject<HTMLVideoElement>,
        initialMuted
    });

    // Hooks
    const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
    const { isPip, togglePip } = usePictureInPicture(videoRef);

    // Ad Block Hook with VAFT backup stream support
    const {
        isEnabled: adBlockEnabled,
        isBlockingAds,
        adInfo,
        shouldHideAds,
        checkFragmentForAds,
        attachToHls,
        detachFromHls,
        isSearchingBackup,
        resetBackupState,
        backupStream,
    } = useAdBlock({
        channelLogin: channelName,
        onBackupStreamFound: (backupUrl) => {
            // Switch to the ad-free backup stream dynamically
            if (hlsPlayerRef.current) {
                console.log('[TwitchPlayer] Switching to backup stream...');
                hlsPlayerRef.current.switchSource(backupUrl);
            } else {
                console.warn('[TwitchPlayer] HLS player not ready for source switch');
            }
        },
    });

    // State
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [availableQualities, setAvailableQualities] = useState<QualityLevel[]>([]);
    const [currentQualityId, setCurrentQualityId] = useState<string>('auto');
    const [isLoading, setIsLoading] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [hasError, setHasError] = useState(false);

    // Apply user's default quality preference
    useDefaultQuality(availableQualities, currentQualityId, setCurrentQualityId);

    // Determine effective mute state (declarative)
    const effectiveMuted = isMuted;

    // Handle ad blocking state tracking (logging mainly)
    useEffect(() => {
        // Legacy imperative mute logic removed in favor of declarative 'effectiveMuted' prop passed to HlsPlayer
        // This ensures React keeps the video element in sync with our state (including persistence)
    }, [isBlockingAds, shouldHideAds]);

    // Track previous blocking state to detect transitions
    const prevIsBlockingAdsRef = useRef(false);

    // Notify parent when ads are detected (for dynamic proxy switching)
    useEffect(() => {
        if (isBlockingAds && !prevIsBlockingAdsRef.current && onAdDetected) {
            onAdDetected();
        }
        prevIsBlockingAdsRef.current = isBlockingAds;
    }, [isBlockingAds, onAdDetected]);

    // Reset state when streamUrl changes (new stream)
    useEffect(() => {
        setHasError(false);
        setIsReady(false); // Reset ready state so initialization runs for new stream
        // Detach ad detector when stream changes
        detachFromHls();
        // Reset backup stream state (clear tried player types)
        resetBackupState();
    }, [streamUrl, detachFromHls, resetBackupState]);

    // Handle HLS instance for ad detection
    const handleHlsInstance = useCallback((hls: import('hls.js').default) => {
        // Attach ad detector to the HLS instance
        if (adBlockEnabled) {
            attachToHls(hls);
            console.log('[TwitchPlayer] Ad detector attached to HLS instance');
        }
    }, [adBlockEnabled, attachToHls]);

    // Cleanup ad detector on unmount
    useEffect(() => {
        return () => {
            detachFromHls();
        };
    }, [detachFromHls]);

    // Setup event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleVideoVolumeChange = () => {
            syncFromVideoElement();
        };
        const handleWaiting = () => setIsLoading(true);
        const handlePlaying = () => setIsLoading(false);
        const handleRateChange = () => setPlaybackRate(video.playbackRate);

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVideoVolumeChange);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ratechange', handleRateChange);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVideoVolumeChange);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ratechange', handleRateChange);
        };
    }, [isReady]);

    // Volume initialization is handled by useVolume hook
    // However, when switching streams (component reuse), the video element is reset.
    // We need to re-apply the persistent volume state when the player becomes ready.
    useEffect(() => {
        if (isReady && videoRef.current) {
            videoRef.current.volume = volume / 100;
            // Mute state is handled by the declarative 'muted' prop on HlsPlayer now
        }
    }, [isReady, volume]);

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

    const toggleMute = handleToggleMute;

    const togglePipHandler = useCallback(async () => {
        await togglePip();
    }, [togglePip]);

    const handlePlaybackRateChange = useCallback((rate: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = rate;
    }, []);

    // Manual stream refresh
    const handleRefreshStream = useCallback(() => {
        const hls = hlsPlayerRef.current?.getHls();
        if (hls) {
            console.log('[TwitchPlayer] Manual stream refresh triggered');
            try {
                hls.recoverMediaError();
            } catch (error) {
                console.warn('[TwitchPlayer] recoverMediaError failed, trying startLoad:', error);
                try {
                    hls.startLoad();
                } catch (e) {
                    console.error('[TwitchPlayer] startLoad failed:', e);
                }
            }
        } else {
            console.warn('[TwitchPlayer] No HLS instance available for refresh');
        }
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
        onRefreshStream: handleRefreshStream,
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
                    handleRef={hlsPlayerRef as React.Ref<HlsPlayerHandle>}
                    src={streamUrl}
                    poster={poster}
                    muted={effectiveMuted}
                    autoPlay={autoPlay}
                    currentLevel={currentQualityId}
                    onQualityLevels={handleQualityLevels}
                    onFragmentLoaded={checkFragmentForAds}
                    onHlsInstance={handleHlsInstance}
                    onError={(error) => {
                        console.error('[TwitchPlayer] Player error:', error);
                        setHasError(true);
                        setIsLoading(false);
                        onError?.(error);
                    }}
                    className={`size-full object-contain cursor-pointer`}
                    controls={false}
                    onDoubleClick={toggleFullscreen}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white z-0">
                    <p>No Stream Source</p>
                </div>
            )}

            {/* Ad Block Overlay */}
            <AdBlockOverlay
                visible={isBlockingAds && shouldHideAds}
                channelName={channelName}
                isMidroll={adInfo?.isMidroll ?? true} // Default to true (midroll) during playback if unknown
                isStripping={isSearchingBackup} // Show 'stripping' (or similar) while searching/switching
            />

            {/* Centered Loading Spinner - Twitch Purple */}
            {isLoading && streamUrl && !isBlockingAds && (
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
                    onRefreshStream={handleRefreshStream}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={handlePlaybackRateChange}
                />
            )}
        </div>
    );
}
