import { useState, useEffect } from 'react';
import { Platform } from '@/shared/auth-types';
import { TwitchStreamResolver } from '@/backend/api/platforms/twitch/twitch-stream-resolver';
import { KickStreamResolver } from '@/backend/api/platforms/kick/kick-stream-resolver';
import { StreamPlayback } from '@/components/player/types';

// Singleton instances
const twitchResolver = new TwitchStreamResolver();
const kickResolver = new KickStreamResolver();

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
                let result: StreamPlayback;

                if (platform === 'twitch') {
                    // Identifier is username (login) for live streams
                    result = await twitchResolver.getStreamPlaybackUrl(identifier);
                } else if (platform === 'kick') {
                    // Identifier is slug for live streams
                    result = await kickResolver.getStreamPlaybackUrl(identifier);
                } else {
                    throw new Error(`Unsupported platform: ${platform}`);
                }

                if (isMounted) {
                    setPlayback(result);
                    setIsLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    console.error(`Failed to load stream playback for ${platform}/${identifier}`, err);
                    setError(err instanceof Error ? err : new Error(String(err)));
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
