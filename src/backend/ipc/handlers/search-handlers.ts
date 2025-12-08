import { ipcMain } from 'electron';
import { Platform } from '../../../shared/auth-types';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { storageService } from '../../services/storage-service';

export function registerSearchHandlers(): void {
    /**
     * Search channels across platforms
     */
    ipcMain.handle(IPC_CHANNELS.SEARCH_CHANNELS, async (_event, params: {
        query: string;
        platform?: Platform;
        liveOnly?: boolean;
        limit?: number;
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            const results: { platform: Platform; data: any[] }[] = [];
            const kickUser = storageService.getKickUser();
            const twitchUser = storageService.getTwitchUser();
            const normalizedQuery = params.query.toLowerCase().trim();

            if (!params.platform || params.platform === 'twitch') {
                try {
                    const result = await twitchClient.searchChannels(params.query, {
                        first: params.limit || 20,
                        liveOnly: params.liveOnly,
                    });

                    // Filter out own account unless exact match
                    let channels = result.data;
                    if (twitchUser) {
                        channels = channels.filter(c => {
                            const matchesUser = c.username.toLowerCase() === twitchUser.login.toLowerCase();
                            if (matchesUser) {
                                return normalizedQuery === twitchUser.login.toLowerCase();
                            }
                            return true;
                        });
                    }

                    results.push({ platform: 'twitch', data: channels });
                } catch (err) {
                    console.warn('⚠️ Failed to search Twitch channels:', err);
                }
            }

            if (!params.platform || params.platform === 'kick') {
                try {
                    const result = await kickClient.searchChannels(params.query);

                    // Filter out own account unless exact match
                    let channels = result.data;
                    if (kickUser) {
                        channels = channels.filter(c => {
                            const matchesUser = c.username.toLowerCase() === kickUser.slug.toLowerCase();
                            if (matchesUser) {
                                return normalizedQuery === kickUser.slug.toLowerCase();
                            }
                            return true;
                        });
                    }

                    results.push({ platform: 'kick', data: channels });
                } catch (err) {
                    console.warn('⚠️ Failed to search Kick channels:', err);
                }
            }

            if (!params.platform) {
                const allChannels = results.flatMap(r => r.data);

                // Sort by relevance: Exact match -> Starts with -> Others
                allChannels.sort((a, b) => {
                    const aName = a.username.toLowerCase();
                    const bName = b.username.toLowerCase();
                    const aDisplay = a.displayName.toLowerCase();
                    const bDisplay = b.displayName.toLowerCase();
                    const q = normalizedQuery;

                    const aExact = aName === q || aDisplay === q;
                    const bExact = bName === q || bDisplay === q;
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;

                    const aStarts = aName.startsWith(q) || aDisplay.startsWith(q);
                    const bStarts = bName.startsWith(q) || bDisplay.startsWith(q);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;

                    return 0;
                });

                return { success: true, data: allChannels };
            }

            return { success: true, ...results[0] };
        } catch (error) {
            console.error('❌ Failed to search channels:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Search failed' };
        }
    });

    /**
     * Full search across all content types
     */
    ipcMain.handle(IPC_CHANNELS.SEARCH_ALL, async (_event, params: {
        query: string;
        platform?: Platform;
        limit?: number;
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            const kickUser = storageService.getKickUser();
            const twitchUser = storageService.getTwitchUser();
            const normalizedQuery = params.query.toLowerCase().trim();

            const results: {
                channels: any[];
                categories: any[];
                streams: any[];
                videos: any[];
                clips: any[];
            } = {
                channels: [],
                categories: [],
                streams: [],
                videos: [],
                clips: [],
            };

            if (!params.platform || params.platform === 'twitch') {
                try {
                    const [channelResult, categoryResult] = await Promise.all([
                        twitchClient.searchChannels(params.query, { first: params.limit || 10, liveOnly: false }),
                        twitchClient.searchCategories(params.query, { first: params.limit || 10 }),
                    ]);

                    // Filter channels
                    if (twitchUser) {
                        const filteredChannels = channelResult.data.filter(c => {
                            const matchesUser = c.username.toLowerCase() === twitchUser.login.toLowerCase();
                            if (matchesUser) {
                                return normalizedQuery === twitchUser.login.toLowerCase();
                            }
                            return true;
                        });
                        results.channels.push(...filteredChannels);

                        // Add live streams from filtered channels
                        const liveChannels = filteredChannels.filter(c => c.isLive);
                        results.streams.push(...liveChannels.map(c => ({ ...c, platform: 'twitch' })));
                    } else {
                        results.channels.push(...channelResult.data);
                        const liveChannels = channelResult.data.filter(c => c.isLive);
                        results.streams.push(...liveChannels.map(c => ({ ...c, platform: 'twitch' })));
                    }

                    results.categories.push(...categoryResult.data);
                } catch (err) {
                    console.warn('⚠️ Failed to search Twitch:', err);
                }
            }

            if (!params.platform || params.platform === 'kick') {
                try {
                    const searchResult = await kickClient.search(params.query);

                    if (searchResult.channels) {
                        let channels = searchResult.channels.map(c => ({
                            ...c,
                            platform: 'kick',
                        }));

                        if (kickUser) {
                            channels = channels.filter(c => {
                                const matchesUser = c.username.toLowerCase() === kickUser.slug.toLowerCase();
                                if (matchesUser) {
                                    return normalizedQuery === kickUser.slug.toLowerCase();
                                }
                                return true;
                            });
                        }
                        results.channels.push(...channels);
                    }

                    if (searchResult.streams) {
                        let streams = searchResult.streams.map(s => ({
                            ...s,
                            platform: 'kick',
                        }));

                        if (kickUser) {
                            streams = streams.filter(s => {
                                const matchesUser = s.channelName.toLowerCase() === kickUser.slug.toLowerCase();
                                if (matchesUser) {
                                    return normalizedQuery === kickUser.slug.toLowerCase();
                                }
                                return true;
                            });
                        }
                        results.streams.push(...streams);
                    }

                    if (searchResult.categories) {
                        results.categories.push(...searchResult.categories.map(c => ({ ...c, platform: 'kick' })));
                    }
                } catch (err) {
                    console.warn('⚠️ Failed to search Kick:', err);
                }
            }

            // Sort channels by relevance
            results.channels.sort((a, b) => {
                const aName = a.username.toLowerCase();
                const bName = b.username.toLowerCase();
                const aDisplay = a.displayName.toLowerCase();
                const bDisplay = b.displayName.toLowerCase();
                const q = normalizedQuery;

                const aExact = aName === q || aDisplay === q;
                const bExact = bName === q || bDisplay === q;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                const aStarts = aName.startsWith(q) || aDisplay.startsWith(q);
                const bStarts = bName.startsWith(q) || bDisplay.startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                return 0;
            });

            return { success: true, data: results };
        } catch (error) {
            console.error('❌ Full search failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Search failed' };
        }
    });
}
