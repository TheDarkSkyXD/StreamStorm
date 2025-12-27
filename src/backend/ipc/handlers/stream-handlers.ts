import { ipcMain } from 'electron';
import { Platform, DEFAULT_ADBLOCK_PREFERENCES } from '../../../shared/auth-types';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { storageService } from '../../services/storage-service';
import { StreamProxyConfig, DEFAULT_STREAM_PROXY_CONFIG } from '../../../shared/proxy-types';
import { TwitchAdBlockConfig, createTwitchAdBlockConfig } from '../../../shared/adblock-types';

export function registerStreamHandlers(): void {
    /**
     * Get top streams from one or both platforms
     */
    ipcMain.handle(IPC_CHANNELS.STREAMS_GET_TOP, async (_event, params: {
        platform?: Platform;
        categoryId?: string;
        language?: string;
        limit?: number;
        cursor?: string;
    } = {}) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            const results: { platform: Platform; data: any[]; cursor?: string }[] = [];

            // Fetch from Twitch if no platform specified or platform is twitch
            if (!params.platform || params.platform === 'twitch') {
                try {
                    const twitchResult = await twitchClient.getTopStreams({
                        first: params.limit || 20,
                        after: params.cursor,
                        gameId: params.categoryId,
                        language: params.language,
                    });
                    results.push({
                        platform: 'twitch',
                        data: twitchResult.data,
                        cursor: twitchResult.cursor,
                    });
                } catch (err) {
                    console.warn('⚠️ Failed to fetch Twitch top streams:', err);
                }
            }

            // Fetch from Kick if no platform specified or platform is kick
            if (!params.platform || params.platform === 'kick') {
                try {
                    const kickResult = await kickClient.getTopStreams({
                        limit: params.limit || 20,
                        categoryId: params.categoryId,
                        language: params.language,
                    });
                    results.push({
                        platform: 'kick',
                        data: kickResult.data,
                        cursor: kickResult.nextPage?.toString(),
                    });
                } catch (err) {
                    console.warn('⚠️ Failed to fetch Kick top streams:', err);
                }
            }

            // Merge and sort by viewer count if fetching from both platforms
            if (!params.platform) {
                const allStreams = results.flatMap(r => r.data);
                allStreams.sort((a, b) => b.viewerCount - a.viewerCount);
                return { success: true, data: allStreams };
            }

            return { success: true, ...results[0] };
        } catch (error) {
            console.error('❌ Failed to get top streams:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch streams' };
        }
    });

    /**
     * Get streams by category
     */
    ipcMain.handle(IPC_CHANNELS.STREAMS_GET_BY_CATEGORY, async (_event, params: {
        categoryId: string;
        platform?: Platform;
        limit?: number;
        cursor?: string;
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            const results: { platform: Platform; data: any[]; cursor?: string }[] = [];

            if (!params.platform || params.platform === 'twitch') {
                try {
                    const result = await twitchClient.getTopStreams({
                        first: params.limit || 20,
                        after: params.cursor,
                        gameId: params.categoryId,
                    });
                    results.push({ platform: 'twitch', data: result.data, cursor: result.cursor });
                } catch (err) {
                    console.warn('⚠️ Failed to fetch Twitch streams by category:', err);
                }
            }

            if (!params.platform || params.platform === 'kick') {
                try {
                    const result = await kickClient.getStreamsByCategory(params.categoryId, {
                        limit: params.limit || 20,
                    });
                    results.push({ platform: 'kick', data: result.data, cursor: result.nextPage?.toString() });
                } catch (err) {
                    console.warn('⚠️ Failed to fetch Kick streams by category:', err);
                }
            }

            if (!params.platform) {
                const allStreams = results.flatMap(r => r.data);
                allStreams.sort((a, b) => b.viewerCount - a.viewerCount);
                return { success: true, data: allStreams };
            }

            return { success: true, ...results[0] };
        } catch (error) {
            console.error('❌ Failed to get streams by category:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch streams' };
        }
    });

    /**
     * Get followed streams (requires authentication OR local follows)
     */
    ipcMain.handle(IPC_CHANNELS.STREAMS_GET_FOLLOWED, async (_event, params: {
        platform?: Platform;
        limit?: number;
        cursor?: string;
    } = {}) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            const results: { platform: Platform; data: any[]; cursor?: string }[] = [];
            const localFollows = storageService.getLocalFollows();

            // Twitch
            if (!params.platform || params.platform === 'twitch') {
                const localTwitch = localFollows.filter(f => f.platform === 'twitch');
                const twitchStreams: any[] = [];
                const seenIds = new Set<string>();

                // 1. Remote (User Authenticated)
                if (twitchClient.isAuthenticated()) {
                    try {
                        const result = await twitchClient.getFollowedStreams({
                            first: params.limit || 100,
                            after: params.cursor,
                        });
                        result.data.forEach(s => {
                            if (!seenIds.has(s.id)) {
                                twitchStreams.push(s);
                                seenIds.add(s.id);
                            }
                        });
                        results.push({ platform: 'twitch', data: twitchStreams, cursor: result.cursor });
                    } catch (err) {
                        console.warn('⚠️ Failed to fetch Twitch remote followed streams:', err);
                    }
                }

                // 2. Local Follows (App Token / Public)
                if (localTwitch.length > 0) {
                    try {
                        const idsToFetch = localTwitch.map(f => f.channelId);

                        if (idsToFetch.length > 0) {
                            const chunks = [];
                            for (let i = 0; i < idsToFetch.length; i += 100) {
                                chunks.push(idsToFetch.slice(i, i + 100));
                            }

                            for (const chunk of chunks) {
                                try {
                                    const localStreamsResult = await twitchClient.getStreamsByUserIds(chunk);
                                    localStreamsResult.data.forEach(s => {
                                        if (!seenIds.has(s.id)) {
                                            twitchStreams.push(s);
                                            seenIds.add(s.id);
                                        }
                                    });
                                } catch (e) {
                                    console.warn('Failed to fetch chunk of local twitch streams', e);
                                }
                            }

                            const existingTwitch = results.find(r => r.platform === 'twitch');
                            if (existingTwitch) {
                                existingTwitch.data = twitchStreams;
                            } else if (twitchStreams.length > 0) {
                                results.push({ platform: 'twitch', data: twitchStreams });
                            }
                        }
                    } catch (err) {
                        console.warn('⚠️ Failed to fetch Twitch local followed streams:', err);
                    }
                }
            }

            // Kick
            if (!params.platform || params.platform === 'kick') {
                const localKick = localFollows.filter(f => f.platform === 'kick');
                const kickStreams: any[] = [];
                const seenIds = new Set<string>();

                // 1. Remote (User Authenticated)
                if (kickClient.isAuthenticated()) {
                    try {
                        const result = await kickClient.getFollowedStreams({
                            limit: params.limit || 100,
                        });
                        result.data.forEach(s => {
                            if (!seenIds.has(s.id)) {
                                kickStreams.push(s);
                                seenIds.add(s.id);
                            }
                        });
                    } catch (err) {
                        console.warn('⚠️ Failed to fetch Kick remote followed streams:', err);
                    }
                }

                // 2. Local Follows (Guest/Public)
                if (localKick.length > 0) {
                    const uniqueSlugs = [...new Set(localKick.map(f => f.channelName))];
                    const promises = uniqueSlugs.map(slug => kickClient.getStreamBySlug(slug));
                    const localResults = await Promise.all(promises);

                    localResults.forEach(s => {
                        if (s && !seenIds.has(s.id)) {
                            kickStreams.push(s);
                            seenIds.add(s.id);
                        }
                    });
                }

                results.push({ platform: 'kick', data: kickStreams });
            }

            if (!params.platform) {
                const allStreams = results.flatMap(r => r.data);
                allStreams.sort((a, b) => b.viewerCount - a.viewerCount);
                return { success: true, data: allStreams };
            }

            return { success: true, ...(results[0] || { data: [] }) };
        } catch (error) {
            console.error('❌ Failed to get followed streams:', error);
            return { success: true, data: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    /**
     * Get stream by channel username/slug
     */
    ipcMain.handle(IPC_CHANNELS.STREAMS_GET_BY_CHANNEL, async (_event, params: {
        platform: Platform;
        username: string;
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            let stream = null;

            if (params.platform === 'twitch') {
                stream = await twitchClient.getStreamByLogin(params.username);
            } else if (params.platform === 'kick') {
                stream = await kickClient.getStreamBySlug(params.username);
            }

            return { success: true, data: stream };
        } catch (error) {
            console.error('❌ Failed to get stream by channel:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch stream' };
        }
    });

    /**
     * Get playback URL for a live stream
     * Supports ad-blocking and optional proxy configuration for Twitch
     *
     * Priority:
     * 1. If useProxy === true → force proxy (overrides ad-block)
     * 2. If ad-block is enabled → use native ad-block
     * 3. If proxy is configured → use proxy
     * 4. Otherwise → use direct stream
     */
    ipcMain.handle(IPC_CHANNELS.STREAMS_GET_PLAYBACK_URL, async (_event, params: {
        platform: Platform;
        channelSlug: string;
        useProxy?: boolean; // undefined = use user preference, true = force, false = skip
    }) => {
        const { TwitchStreamResolver } = await import('../../api/platforms/twitch/twitch-stream-resolver');
        const { KickStreamResolver } = await import('../../api/platforms/kick/kick-stream-resolver');

        const twitchResolver = new TwitchStreamResolver();
        const kickResolver = new KickStreamResolver();

        try {
            if (params.platform === 'twitch') {
                // Safely read preferences with fallback for uninitialized state
                const preferences = storageService.getPreferences() ?? {};
                const adBlockPrefs = preferences.advanced?.adBlock ?? DEFAULT_ADBLOCK_PREFERENCES;
                const userProxyConfig = preferences.advanced?.streamProxy ?? DEFAULT_STREAM_PROXY_CONFIG;

                // Build ad-block config if enabled
                let adBlockConfig: TwitchAdBlockConfig | undefined;
                let proxyConfig: StreamProxyConfig | undefined;

                // Priority:
                // 1. useProxy === true: Force proxy (overrides ad-block)
                // 2. Ad-block enabled && useProxy !== true: Use ad-block
                // 3. Proxy configured && useProxy !== false: Use proxy
                // 4. Otherwise: Direct stream

                if (params.useProxy === true) {
                    // Explicit proxy force - takes precedence over ad-block
                    proxyConfig = userProxyConfig;
                    console.log(`[StreamHandler] Forcing proxy: ${proxyConfig.selectedProxy}`);
                } else if (adBlockPrefs.enabled && params.useProxy !== false) {
                    // Ad-block enabled and proxy not explicitly forced
                    // Use VAFT-style config with hardcoded optimal values
                    adBlockConfig = createTwitchAdBlockConfig(true);
                    console.log(`[StreamHandler] Using VAFT-style ad-block: playerType=${adBlockConfig.playerType}`);
                } else if (
                    params.useProxy !== false && userProxyConfig.selectedProxy !== 'none'
                ) {
                    // Proxy configured and not explicitly disabled
                    proxyConfig = userProxyConfig;
                    console.log(`[StreamHandler] Using proxy: ${proxyConfig.selectedProxy}`);
                }

                // Use the new method that handles both ad-block and proxy
                const result = await twitchResolver.getStreamPlaybackUrlWithAdBlock(
                    params.channelSlug,
                    adBlockConfig,
                    proxyConfig
                );
                return { success: true, data: result };
            } else if (params.platform === 'kick') {
                // Kick doesn't need proxy or ad-block (different ad system)
                const result = await kickResolver.getStreamPlaybackUrl(params.channelSlug);
                return { success: true, data: result };
            }
            throw new Error(`Unsupported platform: ${params.platform}`);
        } catch (error) {
            // "Channel is offline" is expected behavior - don't log as error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.toLowerCase().includes('offline')) {
                console.error('❌ Failed to get stream playback URL:', error);
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to resolve stream URL'
            };
        }
    });

    /**
     * Test proxy connection from the main process (bypasses CSP)
     */
    ipcMain.handle(IPC_CHANNELS.PROXY_TEST_CONNECTION, async (_event, params: {
        proxyConfig: StreamProxyConfig;
    }) => {
        try {
            const { TwitchProxyService } = await import('../../api/platforms/twitch/twitch-proxy-service');
            const proxyService = new TwitchProxyService(params.proxyConfig);
            const result = await proxyService.testConnection();

            return {
                success: result.success,
                latencyMs: result.latencyMs,
                error: result.error,
            };
        } catch (error) {
            console.error('❌ Failed to test proxy connection:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to test proxy',
            };
        }
    });

    /**
     * Find ad-free backup stream (VAFT ad-blocking)
     * Called when ads are detected during playback to find an alternative stream
     * 
     * Phase 1: Supports resolution matching via preferredResolution
     * Phase 2: Supports caching and minimal requests mode via lastPlayerReload
     */
    ipcMain.handle(IPC_CHANNELS.ADBLOCK_FIND_BACKUP_STREAM, async (_event, params: {
        channelLogin: string;
        skipPlayerTypes?: string[];
        timeoutMs?: number;
        preferredResolution?: string;
        lastPlayerReload?: number;
        skipCache?: boolean;
    }) => {
        try {
            const { getBackupStreamService } = await import('../../adblock/twitch-backup-stream-service');
            const backupService = getBackupStreamService();

            const result = await backupService.findAdFreeStream({
                channelLogin: params.channelLogin,
                skipPlayerTypes: params.skipPlayerTypes,
                timeoutMs: params.timeoutMs,
                preferredResolution: params.preferredResolution,
                lastPlayerReload: params.lastPlayerReload,
                skipCache: params.skipCache,
            });

            if (result) {
                return {
                    success: true,
                    data: result,
                };
            } else {
                return {
                    success: false,
                    error: 'No ad-free backup stream found',
                };
            }
        } catch (error) {
            console.error('❌ Failed to find backup stream:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to find backup stream',
            };
        }
    });

    /**
     * Clear backup stream cache (Phase 2)
     * Should be called when switching streams to prevent stale data
     */
    ipcMain.handle(IPC_CHANNELS.ADBLOCK_CLEAR_CACHE, async (_event, params: {
        channelLogin?: string;
    }) => {
        try {
            const { getBackupStreamService } = await import('../../adblock/twitch-backup-stream-service');
            const backupService = getBackupStreamService();
            backupService.clearCache(params.channelLogin);
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to clear backup cache:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to clear cache',
            };
        }
    });
}
