import { useState, useEffect, useCallback } from 'react';
import { Platform } from '@/shared/auth-types';
import { StreamPlayback } from '@/components/player/types';

interface UseStreamPlaybackResult {
    playback: StreamPlayback | null;
    isLoading: boolean;
    error: Error | null;
    reload: () => void;
    /** Whether the current playback URL is using a proxy (Twitch only) */
    isUsingProxy: boolean;
    /** Retry loading the stream without proxy (fallback to direct) */
    retryWithoutProxy: () => void;
}

export function useStreamPlayback(platform: Platform, identifier: string): UseStreamPlaybackResult {
    const [playback, setPlayback] = useState<StreamPlayback | null>(null);
    const [isLoading, setIsLoading] = useState(!!identifier);
    const [error, setError] = useState<Error | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    // Track if we're using proxy to enable fallback
    const [isUsingProxy, setIsUsingProxy] = useState(false);
    // Force disable proxy for fallback
    const [forceNoProxy, setForceNoProxy] = useState(false);

    const currentKey = `${platform}-${identifier}`;

    useEffect(() => {
        // Reset all state when stream identifier changes
        setPlayback(null);
        setIsLoading(!!identifier);
        setError(null);
        setIsUsingProxy(false);
        setForceNoProxy(false);
    }, [currentKey, identifier]);

    useEffect(() => {
        if (!identifier) return;

        let isMounted = true;
        setIsLoading(true);
        setError(null);

        const fetchUrl = async () => {
            try {
                if (!window.electronAPI) {
                    throw new Error('Electron API not available');
                }

                // Use IPC to fetch playback URL from main process
                const result = await window.electronAPI.streams.getPlaybackUrl({
                    platform,
                    channelSlug: identifier,
                });

                if (!result.success || !result.data) {
                    throw new Error(result.error || 'Failed to get stream playback URL');
                }

                if (isMounted) {
                    setPlayback({
                        url: result.data.url,
                        format: result.data.format as 'hls' | 'dash' | 'mp4'
                    });
                    // Detect if this is a proxy URL (check for known proxy domains)
                    const url = result.data.url;
                    const usingProxy = (
                        url.includes('cdn-perfprod.com') ||
                        url.includes('luminous.dev')
                    ) && !forceNoProxy;
                    console.debug(`[useStreamPlayback] Loaded URL:`, {
                        url: url.substring(0, 80) + '...',
                        isProxy: usingProxy,
                        forceNoProxy
                    });
                    setIsUsingProxy(usingProxy);
                    setIsLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    // "Channel is offline" and "not found" are expected behaviors, not errors - don't log them
                    const errorMessageLower = error.message.toLowerCase();
                    const isExpectedError = errorMessageLower.includes('offline') || errorMessageLower.includes('not found');
                    if (!isExpectedError) {
                        console.error(`Failed to load stream playback for ${platform}/${identifier}`, err);
                    }
                    setError(error);
                    setIsLoading(false);
                }
            }
        };

        fetchUrl();

        return () => {
            isMounted = false;
        };
    }, [platform, identifier, reloadKey, forceNoProxy]);

    const retryWithoutProxy = useCallback(() => {
        console.debug('[useStreamPlayback] Retrying without proxy (fallback to direct)');
        setForceNoProxy(true);
        setPlayback(null);
        setError(null);
        setReloadKey(prev => prev + 1);
    }, []);

    return {
        playback,
        isLoading,
        error,
        isUsingProxy,
        reload: () => setReloadKey(prev => prev + 1),
        retryWithoutProxy
    };
}
