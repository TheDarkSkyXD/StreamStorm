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

        let hls: Hls | null = null;

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

                if (autoPlay) {
                    video.play().catch(e => console.warn('Autoplay failed', e));
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
                        isAuto: false
                    }));
                    // Add Auto level
                    onQualityLevelsRef.current([
                        { id: 'auto', label: 'Auto', width: 0, height: 0, bitrate: 0, isAuto: true },
                        ...levels
                    ]);
                }
            });

            // Log non-fatal errors (these are retries in progress)
            hls.on(Hls.Events.ERROR, (event, data) => {
                // Ignore innocuous errors that resolve themselves automatically
                // - bufferStalledError: temporary buffer underrun, HLS.js recovers automatically
                // - levelSwitchError: ABR quality switching hiccup, HLS.js handles internally
                const ignoredErrors = ['bufferStalledError', 'levelSwitchError'];
                if (!ignoredErrors.includes(data.details)) {
                    console.log(`[HLS] Error: ${data.details}, fatal: ${data.fatal}, type: ${data.type}`);
                }

                if (data.fatal) {
                    // Fatal error means all internal retries have been exhausted
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('[HLS] Fatal network error - all retries exhausted, stream likely offline');
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
                        console.warn('[HLS] Buffer stalled, attempting to recover...');
                        // Nudge playhead if stuck
                        if (videoRef.current && !videoRef.current.paused) {
                            hls?.recoverMediaError();
                        }
                    } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        console.log(`[HLS] Network error (will retry automatically): ${data.details}`);
                    }
                }
            });

        } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS (Safari)
            console.log('Using native HLS');
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                if (autoPlay) video.play();
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
                if (autoPlay) video.play().catch(e => console.warn('Autoplay failed', e));
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
