import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type Hls from 'hls.js';
import { useAuthStore } from '@/store/auth-store';
import {
    AD_DATERANGE_PATTERNS,
    AD_SEGMENT_PATTERNS,
    detectAdInManifest,
    detectAdInSegment,
    AdInfo
} from '@/shared/adblock-types';
import {
    TwitchAdDetector,
    createTwitchAdDetector,
    type AdBreakInfo,
    type AdDetectionCallbacks,
} from '@/backend/adblock/twitch-hls-detector';

interface UseAdBlockOptions {
    onAdStart?: (info: AdInfo) => void;
    onAdEnd?: () => void;
    /** Called when a backup stream is found */
    onBackupStreamFound?: (backupUrl: string) => void;
    /** Channel login for backup stream lookup */
    channelLogin?: string;
    /** Current stream resolution for quality matching */
    preferredResolution?: string;
}

export interface BackupStreamResult {
    url: string;
    playerType: string;
    platform: string;
    /** Whether this result was served from cache */
    fromCache?: boolean;
    /** Resolution-matched variant URL if available */
    variantUrl?: string;
}

/**
 * Hook for managing ad-block state and detection.
 * 
 * Provides:
 * - Ad-block configuration from user preferences
 * - Manual fragment checking via checkFragmentForAds
 * - TwitchAdDetector integration via attachToHls/detachFromHls
 * - State management for ad blocking state
 * - VAFT-style backup stream switching when ads detected
 */
export function useAdBlock(options: UseAdBlockOptions = {}) {
    const preferences = useAuthStore(state => state.preferences);
    const adBlockConfig = preferences?.advanced?.adBlock;
    const isEnabled = adBlockConfig?.enabled ?? false;
    const shouldHideAds = adBlockConfig?.hideAdsDuringPlayback ?? true;

    const [isBlockingAds, setIsBlockingAds] = useState(false);
    const [adInfo, setAdInfo] = useState<AdInfo | null>(null);
    const [isSearchingBackup, setIsSearchingBackup] = useState(false);
    const [backupStream, setBackupStream] = useState<BackupStreamResult | null>(null);

    // Keep track of the last ad state to trigger callbacks only on change
    const wasBlockingRef = useRef(false);
    // Track player types we've already tried (to avoid re-trying)
    const triedPlayerTypesRef = useRef<string[]>([]);
    // Track if we're currently searching for backup
    const searchingRef = useRef(false);
    // Track last player reload time for minimal requests mode (Phase 2)
    const lastPlayerReloadTimeRef = useRef<number>(0);

    // Callbacks ref to avoid dependency cycles
    const callbacksRef = useRef(options);
    useEffect(() => {
        callbacksRef.current = options;
    }, [options]);

    // TwitchAdDetector instance
    const detectorRef = useRef<TwitchAdDetector | null>(null);

    /**
     * Search for an ad-free backup stream (VAFT method)
     * Now supports Phase 2 features: caching and minimal requests mode
     */
    const findBackupStream = useCallback(async (channelLogin: string): Promise<BackupStreamResult | null> => {
        if (!window.electronAPI?.adblock) {
            console.warn('[useAdBlock] Electron API not available for backup stream');
            return null;
        }

        if (searchingRef.current) {
            console.log('[useAdBlock] Already searching for backup stream');
            return null;
        }

        searchingRef.current = true;
        setIsSearchingBackup(true);

        try {
            console.log(`[useAdBlock] Searching for ad-free backup stream for ${channelLogin}...`);

            const result = await window.electronAPI.adblock.findBackupStream({
                channelLogin,
                skipPlayerTypes: triedPlayerTypesRef.current,
                timeoutMs: 5000,
                preferredResolution: callbacksRef.current.preferredResolution,
                lastPlayerReload: lastPlayerReloadTimeRef.current,
            });

            if (result.success && result.data) {
                const fromCache = result.data.fromCache ?? false;
                console.log(`[useAdBlock] Found backup stream: ${result.data.playerType}/${result.data.platform}${fromCache ? ' (from cache)' : ''}`);

                // Track this player type so we don't retry it (only if not from cache)
                if (!fromCache) {
                    triedPlayerTypesRef.current.push(result.data.playerType);
                }

                const backup: BackupStreamResult = {
                    url: result.data.variantUrl || result.data.url,
                    playerType: result.data.playerType,
                    platform: result.data.platform,
                    fromCache,
                    variantUrl: result.data.variantUrl,
                };
                setBackupStream(backup);
                return backup;
            } else {
                console.log('[useAdBlock] No ad-free backup found');
                return null;
            }
        } catch (error) {
            console.error('[useAdBlock] Error finding backup stream:', error);
            return null;
        } finally {
            searchingRef.current = false;
            setIsSearchingBackup(false);
        }
    }, []);

    /**
     * Create detector callbacks that update hook state
     */
    const detectorCallbacks = useMemo<AdDetectionCallbacks>(() => ({
        onAdStart: async (info: AdBreakInfo) => {
            if (!wasBlockingRef.current) {
                wasBlockingRef.current = true;
                setIsBlockingAds(true);
                setAdInfo({
                    isAd: true,
                    adId: info.adId,
                    adDuration: info.adDurationMs ? info.adDurationMs / 1000 : undefined,
                    adRemainingMs: info.remainingMs,
                    isMidroll: true, // Assume midroll for now as most detected ads during playback are midrolls
                });
                callbacksRef.current.onAdStart?.({
                    isAd: true,
                    adId: info.adId,
                    adDuration: info.adDurationMs ? info.adDurationMs / 1000 : undefined,
                });

                // Try to find backup stream if channel is known
                const channelLogin = callbacksRef.current.channelLogin;
                if (channelLogin && !searchingRef.current) {
                    const backup = await findBackupStream(channelLogin);
                    if (backup) {
                        callbacksRef.current.onBackupStreamFound?.(backup.url);
                    }
                }
            }
        },
        onAdEnd: () => {
            if (wasBlockingRef.current) {
                wasBlockingRef.current = false;
                setIsBlockingAds(false);
                setAdInfo(null);
                setBackupStream(null);
                callbacksRef.current.onAdEnd?.();
            }
        },
    }), [findBackupStream]);

    /**
     * Attach to an HLS.js instance for automatic ad detection.
     * Call this when the HLS instance is created.
     */
    const attachToHls = useCallback((hls: Hls) => {
        if (!isEnabled) return;

        // Create detector if not exists
        if (!detectorRef.current) {
            detectorRef.current = createTwitchAdDetector(detectorCallbacks);
        }

        detectorRef.current.attach(hls);
        console.log('[useAdBlock] Attached to HLS instance');
    }, [isEnabled, detectorCallbacks]);

    /**
     * Detach from the current HLS.js instance.
     * Call this when the HLS instance is destroyed.
     */
    const detachFromHls = useCallback(() => {
        if (detectorRef.current) {
            detectorRef.current.detach();
            console.log('[useAdBlock] Detached from HLS instance');
        }
    }, []);

    // Reset tried player types when stream changes
    const resetBackupState = useCallback((channelLogin?: string) => {
        triedPlayerTypesRef.current = [];
        setBackupStream(null);
        setIsSearchingBackup(false);
        searchingRef.current = false;

        // Clear cache for this channel (Phase 2)
        if (window.electronAPI?.adblock?.clearCache) {
            window.electronAPI.adblock.clearCache(channelLogin);
            console.log(`[useAdBlock] Cleared backup cache${channelLogin ? ` for ${channelLogin}` : ''}`);
        }
    }, []);

    /**
     * Record a player reload event for minimal requests mode (Phase 2)
     * Call this when the HLS player is reloaded/restarted
     */
    const recordPlayerReload = useCallback(() => {
        lastPlayerReloadTimeRef.current = Date.now();
        console.log('[useAdBlock] Recorded player reload time');
    }, []);

    /**
     * Clear the backup stream cache for a specific channel or all channels (Phase 2)
     */
    const clearBackupCache = useCallback((channelLogin?: string) => {
        if (window.electronAPI?.adblock?.clearCache) {
            window.electronAPI.adblock.clearCache(channelLogin);
            console.log(`[useAdBlock] Cleared backup cache${channelLogin ? ` for ${channelLogin}` : ''}`);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            detectorRef.current?.detach();
            detectorRef.current = null;
        };
    }, []);

    /**
     * Parse HLS fragment data for ad indicators (legacy method)
     * Expected to be called from HLS FRAG_LOADED event
     * 
     * @deprecated Use attachToHls for automatic detection instead
     */
    const checkFragmentForAds = useCallback((data: any) => {
        if (!isEnabled) return;

        let isAd = false;
        let info: AdInfo = { isAd: false };

        // 1. Check segment title/url
        const title = data.frag?.title || '';
        const url = data.frag?.url || '';

        if (detectAdInSegment(title) || detectAdInSegment(url)) {
            isAd = true;
            info = {
                isAd: true,
                adId: 'segment-detection',
                adDuration: data.frag?.duration
            };
        }

        // 2. Check program date time tags / date ranges if available
        // Note: Hls.js might expose this differently depending on version
        if (!isAd && data.frag?.tagList) {
            // Check tag list for ad markers if exposed
            const tags = data.frag.tagList as string[][];
            for (const tag of tags) {
                if (tag[0] === 'EXT-X-DATERANGE') {
                    const dateRangeLine = tag.join(':'); // Reconstruct line
                    if (detectAdInManifest(dateRangeLine)) {
                        isAd = true;
                        info = { isAd: true, adId: 'daterange-detection' };
                        break;
                    }
                }
            }
        }

        // Update state logic
        if (isAd) {
            if (!wasBlockingRef.current) {
                // Ad just started
                wasBlockingRef.current = true;
                setIsBlockingAds(true);
                setAdInfo(info);
                callbacksRef.current.onAdStart?.(info);

                // If we should hide/mute, handled by consumer (player component)
            }
        } else {
            if (wasBlockingRef.current) {
                // Ad just ended
                // Use a small delay to prevent flickering between ad segments
                // But for now, instant switch back
                wasBlockingRef.current = false;
                setIsBlockingAds(false);
                setAdInfo(null);
                callbacksRef.current.onAdEnd?.();
            }
        }
    }, [isEnabled]);

    /**
     * Manual trigger to start/stop ad blocking (useful for testing or external signals)
     */
    const setAdState = useCallback((isAd: boolean, info?: AdInfo) => {
        if (isAd) {
            setIsBlockingAds(true);
            setAdInfo(info || { isAd: true });
            wasBlockingRef.current = true;
        } else {
            setIsBlockingAds(false);
            setAdInfo(null);
            wasBlockingRef.current = false;
        }
    }, []);

    /**
     * Get the underlying detector for advanced use cases
     */
    const getDetector = useCallback(() => detectorRef.current, []);

    return {
        // Configuration
        isEnabled,
        shouldHideAds,

        // State
        isBlockingAds,
        adInfo,
        isSearchingBackup,
        backupStream,

        // HLS.js integration
        attachToHls,
        detachFromHls,

        // Backup stream
        findBackupStream,
        resetBackupState,
        clearBackupCache,
        recordPlayerReload,

        // Legacy methods
        checkFragmentForAds,

        // Manual control
        setAdState,
        getDetector,
    };
}
