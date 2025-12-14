import { useState, useEffect } from 'react';
import { Platform } from '@/shared/auth-types';
import { StreamPlayback } from '@/components/player/types';

interface UseStreamPlaybackResult {
    playback: StreamPlayback | null;
    isLoading: boolean;
    error: Error | null;
    reload: () => void;
}

export function useStreamPlayback(platform: Platform, identifier: string): UseStreamPlaybackResult {
    const [playback, setPlayback] = useState<StreamPlayback | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

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
                    channelSlug: identifier
                });

                if (!result.success || !result.data) {
                    throw new Error(result.error || 'Failed to get stream playback URL');
                }

                if (isMounted) {
                    setPlayback({
                        url: result.data.url,
                        format: result.data.format as 'hls' | 'dash' | 'mp4'
                    });
                    setIsLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    // "Channel is offline" is expected behavior, not an error - don't log it
                    const isOfflineError = error.message.toLowerCase().includes('offline');
                    if (!isOfflineError) {
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
    }, [platform, identifier, reloadKey]);

    return {
        playback,
        isLoading,
        error,
        reload: () => setReloadKey(prev => prev + 1)
    };
}
