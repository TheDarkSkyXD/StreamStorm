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
    const playRequestIdRef = useRef(0); // Track play request to cancel stale ones
    const lastRecoveryAttemptRef = useRef<number | null>(null); // Rate limit recovery attempts

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
                // Validate level index exists to prevent levelSwitchError
                if (!isNaN(levelIndex) && levelIndex >= 0 && hls.levels && levelIndex < hls.levels.length) {
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
        // Reset recovery attempt tracker for new stream
        lastRecoveryAttemptRef.current = null;

        let hls: Hls | null = null;
        // Track event handlers for cleanup (used by native HLS and standard playback)
        let handleLoadedMetadata: (() => void) | null = null;
        let handleError: ((e: Event) => void) | null = null;

        // Safe play helper that handles interruption gracefully
        const safePlay = () => {
            if (!isEffectActive || !video) return;

            // Increment request ID to invalidate previous play attempts
            const currentRequestId = ++playRequestIdRef.current;

            // Small delay to let the browser settle after load
            setTimeout(() => {
                // Check if this request is still valid
                if (!isEffectActive || currentRequestId !== playRequestIdRef.current) {
                    return;
                }

                // Don't play if video is already playing
                if (!video.paused) return;

                pendingPlayRef.current = video.play();
                pendingPlayRef.current
                    .then(() => {
                        if (isEffectActive && currentRequestId === playRequestIdRef.current) {
                            pendingPlayRef.current = null;
                        }
                    })
                    .catch((e: Error) => {
                        if (isEffectActive && currentRequestId === playRequestIdRef.current) {
                            pendingPlayRef.current = null;
                        }

                        // If effect is inactive (stream switched) or request is stale, fully ignore errors
                        if (!isEffectActive || currentRequestId !== playRequestIdRef.current) return;

                        // AbortError: play() was interrupted by a new load request
                        // NotAllowedError: autoplay was prevented by browser policy
                        if (e.name === 'AbortError') {
                            // Silently ignore - this is expected during rapid source changes
                            console.debug('[HLS] Play request interrupted (expected during source change)');
                        } else if (e.name === 'NotAllowedError') {
                            console.warn('[HLS] Autoplay blocked by browser policy - user interaction required');
                        } else {
                            console.error('[HLS] Playback failed with unexpected error:', e);
                        }
                    });
            }, 50); // 50ms delay helps avoid race conditions
        };

        const isHls = src.includes('.m3u8') || src.includes('usher.ttvnw.net');

        if (isHls && Hls.isSupported()) {
            // Detect if this is a proxy URL (for faster failure on proxy errors)
            const isProxyUrl = src.includes('cdn-perfprod.com') || src.includes('luminous.dev');

            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                startFragPrefetch: true, // Start fetching fragment immediately for faster start
                backBufferLength: 90,
                // Refined for stability to prevent bufferStalledError
                liveSyncDurationCount: 3, // Slightly behind live edge for stability
                liveMaxLatencyDurationCount: 8, // More tolerance before jumping to live
                maxBufferLength: 30, // 30 seconds buffer
                maxMaxBufferLength: 60,
                // Buffer stall recovery settings (HLS.js handles these automatically)
                maxBufferHole: 0.5, // Increased tolerance for buffer gaps (default 0.1)
                highBufferWatchdogPeriod: 3, // Seconds before nudging starts (default 3)
                nudgeOffset: 0.2, // Nudge amount per retry (default 0.1)
                nudgeMaxRetry: 5, // Max nudge attempts before fatal (default 3)
                // Buffer append error retry settings
                appendErrorMaxRetry: 5, // Retry buffer append up to 5 times (default 3)
                // Manifest loading retry settings - use fewer retries for proxy URLs
                manifestLoadingMaxRetry: isProxyUrl ? 1 : 3, // Fast fail for proxy
                manifestLoadingRetryDelay: isProxyUrl ? 1000 : 5000, // Shorter delay for proxy
                manifestLoadingMaxRetryTimeout: isProxyUrl ? 5000 : 30000,
                // Level loading retry settings
                levelLoadingMaxRetry: isProxyUrl ? 1 : 3,
                levelLoadingRetryDelay: isProxyUrl ? 1000 : 5000,
                // Fragment loading retry settings - more aggressive for live streams
                // Transient errors like ERR_INCOMPLETE_CHUNKED_ENCODING are common
                fragLoadingMaxRetry: 6, // More retries for fragments (they fail more often on live)
                fragLoadingRetryDelay: 1000, // Faster initial retry (was 5000)
                fragLoadingMaxRetryTimeout: 30000, // Cap total retry time
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

                // Restore current level if set (with validation)
                if (currentLevel !== undefined) {
                    if (currentLevel === 'auto') {
                        hls!.currentLevel = -1;
                    } else {
                        const levelIndex = parseInt(currentLevel, 10);
                        if (!isNaN(levelIndex) && levelIndex >= 0 && levelIndex < data.levels.length) {
                            hls!.currentLevel = levelIndex;
                        }
                    }
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
                // Non-fatal errors that HLS.js recovers from automatically - don't spam the console
                // - bufferStalledError: temporary buffer underrun, recovered via nudging
                // - levelSwitchError: quality switch failed, HLS.js retries
                // - fragLoadError: transient network errors, HLS.js retries
                // - fragParsingError: corrupted segment, HLS.js skips to next
                const silentErrors = ['bufferStalledError', 'levelSwitchError', 'fragLoadError', 'fragParsingError'];

                // Check for 404/403/500 on manifest load - indicates stream is definitely gone or proxy error
                // Stop retrying immediately to prevent console noise
                // @ts-ignore - response exists on ErrorData for network errors
                const statusCode = data.response?.code || data.response?.status || data.networkDetails?.status;

                // Handle critical manifest errors early - no point retrying these
                if (data.details === 'manifestLoadError' && (statusCode === 404 || statusCode === 403)) {
                    console.debug(`[HLS] Stream unavailable (${statusCode}), stopping retries`);
                    hls?.destroy();
                    onErrorRef.current?.({
                        code: 'STREAM_OFFLINE',
                        message: 'Stream offline or unavailable',
                        fatal: true,
                        originalError: data
                    });
                    return;
                }

                // Handle 500 errors specially - likely proxy server error
                if (data.details === 'manifestLoadError' && statusCode === 500) {
                    console.debug(`[HLS] Proxy/server error (${statusCode}), triggering fallback`);
                    hls?.destroy();
                    onErrorRef.current?.({
                        code: 'PROXY_ERROR',
                        message: 'Proxy server error (500)',
                        fatal: true,
                        originalError: data
                    });
                    return;
                }

                // For proxy URLs, treat any fatal manifest error as proxy failure
                if (isProxyUrl && data.details === 'manifestLoadError' && data.fatal) {
                    console.debug(`[HLS] Proxy manifest load failed (status: ${statusCode || 'unknown'})`);
                    hls?.destroy();
                    onErrorRef.current?.({
                        code: 'PROXY_ERROR',
                        message: `Proxy error: ${statusCode || 'manifest load failed'}`,
                        fatal: true,
                        originalError: data
                    });
                    return;
                }

                // Only log errors that are fatal or unexpected (not in silent list)
                const shouldLog = data.fatal || !silentErrors.includes(data.details);
                if (shouldLog) {
                    console.debug(`[HLS] Error: ${data.details}, fatal: ${data.fatal}, type: ${data.type}`,
                        statusCode ? `(status: ${statusCode})` : '');
                }

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
                        case Hls.ErrorTypes.MEDIA_ERROR: {
                            // Rate limit recovery attempts to prevent infinite recovery loops
                            // Per HLS.js docs: only attempt recovery if 5+ seconds since last attempt
                            const now = Date.now();
                            const lastAttempt = lastRecoveryAttemptRef.current;

                            if (!lastAttempt || now - lastAttempt > 5000) {
                                console.log('[HLS] Fatal media error encountered, attempting recovery...');
                                lastRecoveryAttemptRef.current = now;
                                hls?.recoverMediaError();
                            } else {
                                const timeSince = Math.round((now - lastAttempt) / 1000);
                                console.warn(`[HLS] Fatal media error - skipping recovery (only ${timeSince}s since last attempt)`);
                                // If we can't recover, report the error
                                onErrorRef.current?.({
                                    code: 'MEDIA_ERROR',
                                    message: `Fatal media error: ${data.details}`,
                                    fatal: true,
                                    originalError: data
                                });
                                hls?.destroy();
                            }
                            break;
                        }
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
                    // Non-fatal error - HLS.js handles these internally
                    // IMPORTANT: Do NOT call recoverMediaError() for non-fatal errors!
                    // HLS.js automatically handles buffer stalls via nudging (configured above)
                    if (data.details === 'bufferStalledError') {
                        const video = videoRef.current;
                        if (video && !video.paused && video.buffered.length > 0) {
                            const currentTime = video.currentTime;
                            const bufferStart = video.buffered.start(0);

                            // If we're at position 0 (or very close) and buffer starts later,
                            // seek to where the buffer actually begins (startup edge case)
                            if (currentTime < 1 && bufferStart > currentTime + 0.5) {
                                console.debug(`[HLS] Buffer gap at start. Seeking from ${currentTime.toFixed(2)}s to ${bufferStart.toFixed(2)}s`);
                                video.currentTime = bufferStart + 0.1;
                            }
                            // Otherwise let HLS.js handle it via automatic nudging
                            // Do NOT call recoverMediaError() - it can cause bufferAppendError
                        }
                    } else if (data.details === 'levelSwitchError') {
                        // Don't log - handled automatically
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
            handleLoadedMetadata = () => {
                if (autoPlay && isMountedRef.current) safePlay();
            };
            handleError = (e: Event) => {
                onErrorRef.current?.({
                    code: 'NATIVE_ERROR',
                    message: 'Native playback error',
                    fatal: true,
                    originalError: e
                });
            };
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            video.addEventListener('error', handleError);
        } else {
            // Standard Native Playback (e.g. MP4)
            console.log('Using standard native playback');
            video.src = src;
            handleLoadedMetadata = () => {
                if (autoPlay && isMountedRef.current) safePlay();
            };
            handleError = (e: Event) => {
                // Only report error if we really fail
                onErrorRef.current?.({
                    code: 'PLAYBACK_ERROR',
                    message: 'Playback failed',
                    fatal: true,
                    originalError: e
                });
            };
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            video.addEventListener('error', handleError);
        }

        // Store reference for cleanup
        const currentVideo = video;

        return () => {
            // Mark as inactive to filter out stale errors
            isEffectActive = false;
            isMountedRef.current = false;
            pendingPlayRef.current = null;

            if (hls) {
                hls.destroy();
            }
            hlsRef.current = null;

            // Remove event listeners from video element to prevent memory leaks
            if (currentVideo) {
                if (handleLoadedMetadata) {
                    currentVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
                }
                if (handleError) {
                    currentVideo.removeEventListener('error', handleError);
                }
            }
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
