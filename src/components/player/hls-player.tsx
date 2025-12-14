import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import { QualityLevel, PlayerError } from './types';

export interface HlsPlayerProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'onError'> {
    src: string;
    onQualityLevels?: (levels: QualityLevel[]) => void;
    onError?: (error: PlayerError) => void;
    onHlsInstance?: (hls: Hls) => void;
    autoPlay?: boolean;
    currentLevel?: string; // 'auto' or level index as string
}

export const HlsPlayer = forwardRef<HTMLVideoElement, HlsPlayerProps>(({
    src,
    onQualityLevels,
    onError,
    onHlsInstance,
    autoPlay = false,
    currentLevel,
    ...props
}, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const isMountedRef = useRef(true);
    const pendingPlayRef = useRef<Promise<void> | null>(null);

    // Expose video ref to parent
    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    // Handle quality change
    useEffect(() => {
        if (hlsRef.current && currentLevel !== undefined) {
            const hls = hlsRef.current;
            if (currentLevel === 'auto') {
                hls.currentLevel = -1;
            } else {
                const levelIndex = parseInt(currentLevel, 10);
                if (!isNaN(levelIndex) && levelIndex >= 0) {
                    hls.currentLevel = levelIndex;
                }
            }
        }
    }, [currentLevel]);

    // Store callbacks in refs to prevent re-initialization loop
    const onQualityLevelsRef = useRef(onQualityLevels);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onQualityLevelsRef.current = onQualityLevels;
        onErrorRef.current = onError;
    }, [onQualityLevels, onError]);


    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        // Scoped active flag to handle rapid stream switching robustly
        let isEffectActive = true;
        isMountedRef.current = true;

        let hls: Hls | null = null;

        // Safe play helper that handles interruption gracefully
        const safePlay = () => {
            if (!isEffectActive || !video) return;

            // Cancel any pending play promise tracking
            pendingPlayRef.current = video.play();
            pendingPlayRef.current
                .then(() => {
                    if (isEffectActive) pendingPlayRef.current = null;
                })
                .catch((e: Error) => {
                    if (isEffectActive) pendingPlayRef.current = null;

                    // If effect is inactive (stream switched), fully ignore errors
                    if (!isEffectActive) return;

                    // AbortError: play() was interrupted by a new load request
                    // NotAllowedError: autoplay was prevented by browser policy
                    if (e.name === 'AbortError') {
                        // Log this even if expected, to help debug "stuck" states
                        console.warn('[HLS] Play request interrupted by new load or pause (AbortError)', e);
                    } else if (e.name === 'NotAllowedError') {
                        console.error('[HLS] Autoplay blocked by browser policy (NotAllowedError)', e);
                    } else {
                        console.error('[HLS] Playback failed with unexpected error:', e);
                    }
                });
        };

        const isHls = src.includes('.m3u8') || src.includes('usher.ttvnw.net');

        if (isHls && Hls.isSupported()) {
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
                // Refined for stability to prevent bufferStalledError
                liveSyncDurationCount: 2, // Closer to live edge (was 3)
                liveMaxLatencyDurationCount: 5, // Jump to live sooner if behind (was 10)
                maxBufferLength: 30, // 30 seconds buffer
                maxMaxBufferLength: 60,
                // Manifest loading retry settings - 3 retries with 5 second delays
                manifestLoadingMaxRetry: 3,
                manifestLoadingRetryDelay: 5000,
                manifestLoadingMaxRetryTimeout: 30000,
                // Level loading retry settings
                levelLoadingMaxRetry: 3,
                levelLoadingRetryDelay: 5000,
                // Fragment loading retry settings  
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: 5000,
                xhrSetup: (xhr, url) => {
                    xhr.withCredentials = false; // Important to avoid CORS issues with wildcards
                },
            });
            hlsRef.current = hls;
            if (onHlsInstance) onHlsInstance(hls);

            console.log('Initializing HLS for:', src);
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                console.log('[HLS] Manifest parsed, levels:', data.levels.length);

                if (autoPlay && isMountedRef.current) {
                    safePlay();
                }

                // Restore current level if set
                if (currentLevel !== undefined) {
                    if (currentLevel === 'auto') hls!.currentLevel = -1;
                    else hls!.currentLevel = parseInt(currentLevel, 10);
                }

                if (onQualityLevelsRef.current && data.levels) {
                    const levels: QualityLevel[] = data.levels.map((level, index) => ({
                        id: index.toString(),
                        label: level.height ? `${level.height}p${level.frameRate && level.frameRate > 30 ? level.frameRate : ''}` : `Level ${index}`,
                        width: level.width,
                        height: level.height,
                        bitrate: level.bitrate,
                        frameRate: level.frameRate,
                        isAuto: false,
                        name: level.name
                    }));
                    // Add Auto level
                    onQualityLevelsRef.current([
                        { id: 'auto', label: 'Auto', width: 0, height: 0, bitrate: 0, isAuto: true },
                        ...levels
                    ]);
                }
            });

            // Handle HLS errors - distinguish between expected stream-ending scenarios and actual errors
            hls.on(Hls.Events.ERROR, (event, data) => {
                // Completely ignore innocuous errors that resolve themselves automatically
                // - bufferStalledError: temporary buffer underrun, HLS.js recovers automatically
                // Reporting all errors for debugging robust stream handling
                const silentErrors: string[] = []; // Was ['bufferStalledError', 'levelSwitchError'];

                // Check for 404/403 on manifest load - indicates stream is definitely gone
                // Stop retrying immediately to prevent console noise
                // @ts-ignore - response exists on ErrorData for network errors
                const statusCode = data.response?.code;
                if (data.details === 'manifestLoadError' && (statusCode === 404 || statusCode === 403)) {
                    console.debug(`[HLS] Critical network error ${statusCode}, stopping retries`);
                    hls?.destroy();
                    onErrorRef.current?.({
                        code: 'STREAM_OFFLINE',
                        message: 'Stream offline or unavailable',
                        fatal: true,
                        originalError: data
                    });
                    return;
                }

                // Log all errors for now to debug the "stuck in loading" issue
                console.log(`[HLS] Error details: ${data.details}, fatal: ${data.fatal}, type: ${data.type}`, data);

                const isStreamEndingError =
                    data.details === 'manifestLoadError' ||
                    data.details === 'levelLoadError' ||
                    data.details === 'fragLoadError';

                if (data.fatal) {
                    // Fatal error means all internal retries have been exhausted
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            // Stream likely ended - this is expected behavior, not an error
                            // Log as debug instead of error to reduce console noise
                            console.debug('[HLS] Stream ended or became unavailable (network error after retries)');
                            onErrorRef.current?.({
                                code: 'STREAM_OFFLINE',
                                message: 'Stream offline or unavailable',
                                fatal: true,
                                originalError: data
                            });
                            hls?.destroy();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('[HLS] Fatal media error encountered, trying to recover...');
                            hls?.recoverMediaError();
                            break;
                        default:
                            console.error('[HLS] Unrecoverable error', data);
                            onErrorRef.current?.({
                                code: 'HLS_FATAL',
                                message: `Fatal HLS Error: ${data.details}`,
                                fatal: true,
                                originalError: data
                            });
                            hls?.destroy();
                            break;
                    }
                } else {
                    // Non-fatal error - HLS.js is handling this internally (retrying)
                    if (data.details === 'bufferStalledError') {
                        // Don't log as warning - this is handled automatically
                        if (videoRef.current && !videoRef.current.paused) {
                            hls?.recoverMediaError();
                        }
                    } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !isStreamEndingError) {
                        // Only log network retries for non-stream-ending errors
                        console.debug(`[HLS] Network error (will retry automatically): ${data.details}`);
                    }
                }
            });

        } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS (Safari)
            console.log('Using native HLS');
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                if (autoPlay && isMountedRef.current) safePlay();
            });
            video.addEventListener('error', (e) => {
                onErrorRef.current?.({
                    code: 'NATIVE_ERROR',
                    message: 'Native playback error',
                    fatal: true,
                    originalError: e
                });
            });
        } else {
            // Standard Native Playback (e.g. MP4)
            console.log('Using standard native playback');
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                if (autoPlay && isMountedRef.current) safePlay();
            });
            video.addEventListener('error', (e) => {
                // Only report error if we really fail
                onErrorRef.current?.({
                    code: 'PLAYBACK_ERROR',
                    message: 'Playback failed',
                    fatal: true,
                    originalError: e
                });
            });
        }

        return () => {
            // Mark as inactive to filter out stale errors
            isEffectActive = false;
            isMountedRef.current = false;
            pendingPlayRef.current = null;

            if (hls) {
                hls.destroy();
            }
            hlsRef.current = null;
        };
    }, [src, autoPlay]); // Removed callbacks from dependency array
    // removed currentLevel (except initial read in manifest parsed) to prevent re-init. 
    // Logic for dynamic switching is in the first useEffect.

    return (
        <video
            ref={videoRef}
            playsInline
            className="size-full object-contain"
            {...props}
        />
    );
});

HlsPlayer.displayName = 'HlsPlayer';
