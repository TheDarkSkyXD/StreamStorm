/**
 * Twitch HLS Player with Ad-Blocking
 *
 * A wrapper around HlsPlayer that integrates the VAFT-based ad-blocking system.
 * This component initializes the ad-block service and uses custom HLS.js loaders
 * to intercept and process m3u8 playlists.
 */

import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { QualityLevel, PlayerError } from '../types';
import { AdBlockStatus } from '@/shared/adblock-types';
import {
    initAdBlockService,
    setPlayerCallbacks,
    setStatusChangeCallback,
    setAuthHeaders,
    getAdBlockStatus,
    clearStreamInfo,
    isAdBlockEnabled,
} from './twitch-adblock-service';
import { getAdBlockHlsConfig } from './twitch-adblock-loader';

export interface TwitchHlsPlayerProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'onError'> {
    src: string;
    channelName: string;
    onQualityLevels?: (levels: QualityLevel[]) => void;
    onError?: (error: PlayerError) => void;
    onHlsInstance?: (hls: Hls) => void;
    onAdBlockStatusChange?: (status: AdBlockStatus) => void;
    autoPlay?: boolean;
    currentLevel?: string;
    enableAdBlock?: boolean;
}

export const TwitchHlsPlayer = forwardRef<HTMLVideoElement, TwitchHlsPlayerProps>(({
    src,
    channelName,
    onQualityLevels,
    onError,
    onHlsInstance,
    onAdBlockStatusChange,
    autoPlay = false,
    currentLevel,
    enableAdBlock = true,
    ...props
}, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const isMountedRef = useRef(true);
    const pendingPlayRef = useRef<Promise<void> | null>(null);
    const playRequestIdRef = useRef(0);
    const lastRecoveryAttemptRef = useRef<number | null>(null);
    const [adBlockStatus, setAdBlockStatus] = useState<AdBlockStatus | null>(null);

    // Expose video ref to parent
    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    // Store callbacks in refs
    const onQualityLevelsRef = useRef(onQualityLevels);
    const onErrorRef = useRef(onError);
    const onAdBlockStatusChangeRef = useRef(onAdBlockStatusChange);

    useEffect(() => {
        onQualityLevelsRef.current = onQualityLevels;
        onErrorRef.current = onError;
        onAdBlockStatusChangeRef.current = onAdBlockStatusChange;
    }, [onQualityLevels, onError, onAdBlockStatusChange]);

    // Initialize ad-block service
    useEffect(() => {
        if (enableAdBlock) {
            initAdBlockService({ enabled: true });
            setStatusChangeCallback((status) => {
                setAdBlockStatus(status);
                onAdBlockStatusChangeRef.current?.(status);
            });
            
            // Initialize auth headers for backup stream fetching
            // Generate a persistent device ID (stored in localStorage) or use existing
            let deviceId = localStorage.getItem('twitch_adblock_device_id');
            if (!deviceId) {
                const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
                deviceId = '';
                for (let i = 0; i < 32; i++) {
                    deviceId += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                localStorage.setItem('twitch_adblock_device_id', deviceId);
            }
            setAuthHeaders(deviceId);
            console.debug('[TwitchHlsPlayer] Ad-block initialized with device ID');
        }

        return () => {
            // Clear stream info on unmount
            if (channelName) {
                clearStreamInfo(channelName);
            }
        };
    }, [enableAdBlock, channelName]);

    // Handle quality change
    useEffect(() => {
        if (hlsRef.current && currentLevel !== undefined) {
            const hls = hlsRef.current;
            if (currentLevel === 'auto') {
                hls.currentLevel = -1;
            } else {
                const levelIndex = parseInt(currentLevel, 10);
                if (!isNaN(levelIndex) && levelIndex >= 0 && hls.levels && levelIndex < hls.levels.length) {
                    hls.currentLevel = levelIndex;
                }
            }
        }
    }, [currentLevel]);

    // Player control callbacks for ad-block service
    const handlePlayerReload = useCallback(() => {
        const video = videoRef.current;
        const hls = hlsRef.current;
        if (!video || !hls) return;

        console.debug('[TwitchHlsPlayer] Ad-block triggered player reload');
        // Restart from live edge
        hls.startLoad(-1);
    }, []);

    const handlePauseResume = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        console.debug('[TwitchHlsPlayer] Ad-block triggered pause/resume');
        if (!video.paused) {
            video.pause();
            setTimeout(() => {
                video.play().catch(() => {});
            }, 100);
        }
    }, []);

    // Register player callbacks with ad-block service
    useEffect(() => {
        if (enableAdBlock) {
            setPlayerCallbacks(handlePlayerReload, handlePauseResume);
        }
    }, [enableAdBlock, handlePlayerReload, handlePauseResume]);

    // Main HLS initialization effect
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        let isEffectActive = true;
        isMountedRef.current = true;
        lastRecoveryAttemptRef.current = null;

        let hls: Hls | null = null;
        let handleLoadedMetadata: (() => void) | null = null;
        let handleError: ((e: Event) => void) | null = null;
        let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

        const safePlay = () => {
            if (!isEffectActive || !video) return;

            const currentRequestId = ++playRequestIdRef.current;

            setTimeout(() => {
                if (!isEffectActive || currentRequestId !== playRequestIdRef.current) return;
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
                        if (!isEffectActive || currentRequestId !== playRequestIdRef.current) return;
                        if (e.name === 'AbortError') {
                            console.debug('[TwitchHLS] Play request interrupted');
                        } else if (e.name === 'NotAllowedError') {
                            console.warn('[TwitchHLS] Autoplay blocked by browser policy');
                        } else {
                            console.error('[TwitchHLS] Playback failed:', e);
                        }
                    });
            }, 50);
        };

        const isHls = src.includes('.m3u8') || src.includes('usher.ttvnw.net');

        if (isHls && Hls.isSupported()) {
            // Get ad-blocking loaders if enabled
            const adBlockConfig = enableAdBlock && isAdBlockEnabled()
                ? getAdBlockHlsConfig(channelName)
                : {};

            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                startFragPrefetch: true,
                backBufferLength: 90,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 8,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferHole: 0.5,
                highBufferWatchdogPeriod: 3,
                nudgeOffset: 0.2,
                nudgeMaxRetry: 5,
                appendErrorMaxRetry: 5,

                // Manifest loading
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 2,
                manifestLoadingRetryDelay: 500,
                manifestLoadingMaxRetryTimeout: 15000,

                // Level loading
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 2,
                levelLoadingRetryDelay: 500,
                levelLoadingMaxRetryTimeout: 15000,

                // Fragment loading
                fragLoadingTimeOut: 15000,
                fragLoadingMaxRetry: 4,
                fragLoadingRetryDelay: 500,
                fragLoadingMaxRetryTimeout: 20000,

                xhrSetup: (xhr) => {
                    xhr.withCredentials = false;
                },

                // Ad-blocking loaders
                ...adBlockConfig,
            });

            hlsRef.current = hls;
            if (onHlsInstance) onHlsInstance(hls);

            console.debug('[TwitchHLS] Initializing for:', channelName, 'adBlock:', enableAdBlock);
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                console.debug('[TwitchHLS] Manifest parsed, levels:', data.levels.length);

                if (autoPlay && isMountedRef.current) {
                    safePlay();
                }

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
                    // Build initial labels
                    const rawLevels = data.levels.map((level, index) => {
                        const baseLabel = level.name
                            ? level.name
                            : level.height
                                ? `${level.height}p${level.frameRate ? Math.round(level.frameRate) : ''}`
                                : `Level ${index}`;
                        return {
                            id: index.toString(),
                            label: baseLabel,
                            width: level.width,
                            height: level.height,
                            bitrate: level.bitrate,
                            frameRate: level.frameRate,
                            isAuto: false,
                            name: level.name
                        };
                    });

                    // Find the source quality (highest bitrate)
                    const maxBitrate = Math.max(...rawLevels.map(l => l.bitrate || 0));

                    // Deduplicate labels by appending bitrate when duplicates exist
                    const labelCounts = new Map<string, number>();
                    rawLevels.forEach(l => labelCounts.set(l.label, (labelCounts.get(l.label) || 0) + 1));

                    const levels: QualityLevel[] = rawLevels.map((level) => {
                        let finalLabel = level.label;
                        
                        // Mark the highest bitrate level as source
                        if (level.bitrate === maxBitrate && maxBitrate > 0) {
                            finalLabel = `${finalLabel} (source)`;
                        } else if (labelCounts.get(level.label)! > 1 && level.bitrate > 0) {
                            // Deduplicate other labels by appending bitrate
                            finalLabel = `${finalLabel} (${Math.round(level.bitrate / 1000)}k)`;
                        }
                        
                        return { ...level, label: finalLabel };
                    });

                    onQualityLevelsRef.current([
                        { id: 'auto', label: 'Auto', width: 0, height: 0, bitrate: 0, isAuto: true },
                        ...levels
                    ]);
                }
            });

            // Error handling
            hls.on(Hls.Events.ERROR, (event, data) => {
                const silentErrors = ['bufferStalledError', 'levelSwitchError', 'fragLoadError', 'fragParsingError'];
                // @ts-expect-error - response exists on network errors
                const statusCode = data.response?.code || data.response?.status || data.networkDetails?.status;

                if (data.details === 'manifestLoadError' && (statusCode === 404 || statusCode === 403)) {
                    console.debug(`[TwitchHLS] Stream unavailable (${statusCode})`);
                    hls?.destroy();
                    onErrorRef.current?.({
                        code: 'STREAM_OFFLINE',
                        message: 'Stream offline or unavailable',
                        fatal: true,
                        originalError: data
                    });
                    return;
                }

                const shouldLog = data.fatal || !silentErrors.includes(data.details);
                if (shouldLog) {
                    console.debug(`[TwitchHLS] Error: ${data.details}, fatal: ${data.fatal}`, statusCode ? `(status: ${statusCode})` : '');
                }

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.debug('[TwitchHLS] Stream ended or unavailable');
                            onErrorRef.current?.({
                                code: 'STREAM_OFFLINE',
                                message: 'Stream offline or unavailable',
                                fatal: true,
                                originalError: data
                            });
                            hls?.destroy();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR: {
                            const now = Date.now();
                            const lastAttempt = lastRecoveryAttemptRef.current;
                            if (!lastAttempt || now - lastAttempt > 5000) {
                                console.debug('[TwitchHLS] Attempting media error recovery');
                                lastRecoveryAttemptRef.current = now;
                                hls?.recoverMediaError();
                            } else {
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
                            console.error('[TwitchHLS] Unrecoverable error', data);
                            onErrorRef.current?.({
                                code: 'HLS_FATAL',
                                message: `Fatal HLS Error: ${data.details}`,
                                fatal: true,
                                originalError: data
                            });
                            hls?.destroy();
                            break;
                    }
                }
            });

            // Fragment loading tracker for offline detection
            let lastFragLoadedTime = Date.now();
            hls.on(Hls.Events.FRAG_LOADED, () => {
                lastFragLoadedTime = Date.now();
            });

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                heartbeatInterval = setInterval(() => {
                    if (!isEffectActive || !hls) {
                        if (heartbeatInterval) clearInterval(heartbeatInterval);
                        return;
                    }
                    const timeSinceLastFrag = Date.now() - lastFragLoadedTime;
                    if (timeSinceLastFrag > 15000) {
                        console.debug(`[TwitchHLS] No fragments in ${Math.round(timeSinceLastFrag / 1000)}s, checking stream...`);
                        try {
                            hls.startLoad(-1);
                        } catch {
                            // HLS may be in invalid state
                        }
                    }
                }, 10000);
            });

        } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS (Safari)
            console.debug('[TwitchHLS] Using native HLS');
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
            // Standard playback
            console.debug('[TwitchHLS] Using standard native playback');
            video.src = src;
            handleLoadedMetadata = () => {
                if (autoPlay && isMountedRef.current) safePlay();
            };
            handleError = (e: Event) => {
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

        const currentVideo = video;

        return () => {
            isEffectActive = false;
            isMountedRef.current = false;
            pendingPlayRef.current = null;

            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }

            if (hls) {
                hls.destroy();
            }
            hlsRef.current = null;

            if (currentVideo) {
                if (handleLoadedMetadata) {
                    currentVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
                }
                if (handleError) {
                    currentVideo.removeEventListener('error', handleError);
                }
            }

            // Clear stream info
            if (channelName) {
                clearStreamInfo(channelName);
            }
        };
    }, [src, autoPlay, channelName, enableAdBlock]);

    return (
        <video
            ref={videoRef}
            playsInline
            className="size-full object-contain"
            {...props}
        />
    );
});

TwitchHlsPlayer.displayName = 'TwitchHlsPlayer';
