import { ipcMain } from 'electron';
import { Platform } from '../../../shared/auth-types';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { storageService } from '../../services/storage-service';

/**
 * Helper to validate a channel object has the required fields
 * Filters out deleted/invalid channels from search results
 */
function isValidChannel(channel: any): boolean {
    // Must have basic identifying info
    if (!channel.id || !channel.username) {
        return false;
    }
    // Skip if explicitly marked as deleted or banned (Kick)
    if (channel.is_banned === true || channel.is_deleted === true) {
        return false;
    }
    return true;
}

// Cache verified channels to avoid repeated API calls (5 minute TTL)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache for Twitch channel data (includes fresh avatar URLs)
 */
const twitchChannelDataCache = new Map<string, { data: any | null; timestamp: number }>();

/**
 * Verify Twitch channels exist and fetch their fresh avatar URLs
 * Returns a Map of username -> enriched channel data with fresh avatars
 */
async function verifyAndEnrichTwitchChannels(channels: any[]): Promise<Map<string, any>> {
    const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');

    const enrichedChannels = new Map<string, any>();
    const loginsToFetch: { login: string; originalChannel: any }[] = [];
    const now = Date.now();

    // Check cache first
    for (const channel of channels) {
        const loginLower = channel.username.toLowerCase();
        const cached = twitchChannelDataCache.get(loginLower);

        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
            if (cached.data) {
                // Merge cached data (with fresh avatar and display name) into the channel
                enrichedChannels.set(loginLower, {
                    ...channel,
                    avatarUrl: cached.data.profileImageUrl || channel.avatarUrl || '',
                    displayName: cached.data.displayName || channel.displayName,
                });
            }
            // If cached.data is null, channel doesn't exist - skip it
        } else {
            loginsToFetch.push({ login: channel.username, originalChannel: channel });
        }
    }

    // Fetch uncached channels via API (batch in groups of 100)
    if (loginsToFetch.length > 0) {
        try {
            // Twitch API supports up to 100 logins per request
            const batchSize = 100;
            for (let i = 0; i < loginsToFetch.length; i += batchSize) {
                const batch = loginsToFetch.slice(i, i + batchSize);
                const logins = batch.map(item => item.login);
                const users = await twitchClient.getUsersByLogin(logins);

                // Create a map of login -> user data for quick lookup
                const userMap = new Map(users.map(u => [u.login.toLowerCase(), u]));

                for (const { login, originalChannel } of batch) {
                    const loginLower = login.toLowerCase();
                    const user = userMap.get(loginLower);

                    if (user) {
                        // Cache the fetched user data
                        twitchChannelDataCache.set(loginLower, {
                            data: user,
                            timestamp: now
                        });

                        // Merge fetched data (with fresh avatar) into the original channel
                        enrichedChannels.set(loginLower, {
                            ...originalChannel,
                            avatarUrl: user.profileImageUrl || originalChannel.avatarUrl || '',
                            displayName: user.displayName || originalChannel.displayName,
                        });
                    } else {
                        // Channel doesn't exist - cache as null
                        twitchChannelDataCache.set(loginLower, {
                            data: null,
                            timestamp: now
                        });
                        console.log(`[ChannelVerify] Twitch channel "${login}" does not exist (deleted account)`);
                    }
                }
            }
        } catch (error) {
            console.warn('[ChannelVerify] Failed to fetch Twitch channels:', error);
            // On error, include original channels without enrichment
            for (const { login, originalChannel } of loginsToFetch) {
                enrichedChannels.set(login.toLowerCase(), originalChannel);
            }
        }
    }

    return enrichedChannels;
}

/**
 * Cache for Kick channel data (includes avatar URLs)
 */
const kickChannelDataCache = new Map<string, { data: any | null; timestamp: number }>();

/**
 * Verify Kick channels exist and fetch their avatar URLs
 * Returns a Map of username -> enriched channel data with avatars
 */
async function verifyAndEnrichKickChannels(channels: any[]): Promise<Map<string, any>> {
    const { getPublicChannel } = await import('../../api/platforms/kick/endpoints/channel-endpoints');

    const enrichedChannels = new Map<string, any>();
    const slugsToFetch: { slug: string; originalChannel: any }[] = [];
    const now = Date.now();

    // Check cache first
    for (const channel of channels) {
        const slugLower = channel.username.toLowerCase();
        const cached = kickChannelDataCache.get(slugLower);

        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
            if (cached.data) {
                // Merge cached data (with avatar and live status) into the channel
                enrichedChannels.set(slugLower, {
                    ...channel,
                    avatarUrl: cached.data.avatarUrl || channel.avatarUrl || '',
                    displayName: cached.data.displayName || channel.displayName,
                    isVerified: cached.data.isVerified || channel.isVerified,
                    isLive: cached.data.isLive, // Use authoritative live status from cache
                });
            }
            // If cached.data is null, channel doesn't exist - skip it
        } else {
            slugsToFetch.push({ slug: channel.username, originalChannel: channel });
        }
    }

    // Fetch uncached channels via API (parallel with limit)
    if (slugsToFetch.length > 0) {
        // Limit concurrent requests to avoid overwhelming the API
        const concurrencyLimit = 5;

        for (let i = 0; i < slugsToFetch.length; i += concurrencyLimit) {
            const batch = slugsToFetch.slice(i, i + concurrencyLimit);

            try {
                const results = await Promise.allSettled(
                    batch.map(item => getPublicChannel(item.slug))
                );

                for (let j = 0; j < batch.length; j++) {
                    const { slug, originalChannel } = batch[j];
                    const slugLower = slug.toLowerCase();
                    const result = results[j];

                    if (result.status === 'fulfilled' && result.value !== null) {
                        const fetchedChannel = result.value;

                        // Cache the fetched channel data
                        kickChannelDataCache.set(slugLower, {
                            data: fetchedChannel,
                            timestamp: now
                        });

                        // Merge fetched data (with avatar) into the original channel
                        enrichedChannels.set(slugLower, {
                            ...originalChannel,
                            avatarUrl: fetchedChannel.avatarUrl || originalChannel.avatarUrl || '',
                            displayName: fetchedChannel.displayName || originalChannel.displayName,
                            isVerified: fetchedChannel.isVerified || originalChannel.isVerified,
                            isLive: fetchedChannel.isLive, // Use authoritative live status
                        });
                    } else {
                        // Channel doesn't exist - cache as null
                        kickChannelDataCache.set(slugLower, {
                            data: null,
                            timestamp: now
                        });
                        console.log(`[ChannelVerify] Kick channel "${slug}" does not exist (deleted account)`);
                    }
                }
            } catch (error) {
                console.warn('[ChannelVerify] Failed to fetch Kick channels batch:', error);
                // On error, include original channels without enrichment
                for (const { slug, originalChannel } of batch) {
                    enrichedChannels.set(slug.toLowerCase(), originalChannel);
                }
            }
        }
    }

    return enrichedChannels;
}

/**
 * Filter channels by verifying they exist via platform APIs
 * Removes deleted/non-existent accounts from results
 * Also enriches channels with fresh avatar URLs from API
 */
async function filterVerifiedChannels(channels: any[], platform: Platform): Promise<any[]> {
    if (channels.length === 0) return [];

    if (platform === 'twitch') {
        // For Twitch, we enrich channels with fresh avatar URLs during verification
        const enrichedChannelsMap = await verifyAndEnrichTwitchChannels(channels);
        // Return enriched channels as an array (preserves order of original channels that exist)
        return channels
            .filter(c => enrichedChannelsMap.has(c.username.toLowerCase()))
            .map(c => enrichedChannelsMap.get(c.username.toLowerCase()));
    } else if (platform === 'kick') {
        // For Kick, we enrich channels with avatar URLs during verification
        const enrichedChannelsMap = await verifyAndEnrichKickChannels(channels);
        // Return enriched channels as an array (preserves order of original channels that exist)
        return channels
            .filter(c => enrichedChannelsMap.has(c.username.toLowerCase()))
            .map(c => enrichedChannelsMap.get(c.username.toLowerCase()));
    }

    return channels;
}

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
            const kickUser = storageService.getKickUser();
            const twitchUser = storageService.getTwitchUser();
            const normalizedQuery = params.query.toLowerCase().trim();
            // Only verify for full searches (limit > 25), skip for dropdown suggestions (limit <= 25)
            const shouldVerify = (params.limit || 20) > 25;

            // Create search promises for parallel execution
            const searchPromises: Promise<{ platform: Platform; data: any[] }>[] = [];

            // Twitch search
            if (!params.platform || params.platform === 'twitch') {
                searchPromises.push(
                    (async () => {
                        const result = await twitchClient.searchChannels(params.query, {
                            first: params.limit || 20,
                            liveOnly: params.liveOnly,
                        });

                        let channels = result.data.filter(isValidChannel);
                        if (twitchUser) {
                            channels = channels.filter(c => {
                                const matchesUser = c.username.toLowerCase() === twitchUser.login.toLowerCase();
                                if (matchesUser) {
                                    return normalizedQuery === twitchUser.login.toLowerCase();
                                }
                                return true;
                            });
                        }

                        // Only verify/enrich for full searches (not quick suggestions)
                        if (shouldVerify) {
                            channels = await filterVerifiedChannels(channels, 'twitch');
                        }

                        return { platform: 'twitch' as Platform, data: channels };
                    })().catch(err => {
                        console.warn('⚠️ Failed to search Twitch channels:', err);
                        return { platform: 'twitch' as Platform, data: [] };
                    })
                );
            }

            // Kick search
            if (!params.platform || params.platform === 'kick') {
                searchPromises.push(
                    (async () => {
                        console.log(`[SearchHandler] Searching Kick for "${params.query}"`);
                        const result = await kickClient.searchChannels(params.query);
                        console.log(`[SearchHandler] Kick returned ${result.data.length} raw results`);

                        let channels = result.data.filter(isValidChannel);
                        console.log(`[SearchHandler] Kick after validation: ${channels.length} channels`);

                        if (kickUser) {
                            channels = channels.filter(c => {
                                const matchesUser = c.username.toLowerCase() === kickUser.slug.toLowerCase();
                                if (matchesUser) {
                                    return normalizedQuery === kickUser.slug.toLowerCase();
                                }
                                return true;
                            });
                        }

                        // Only verify/enrich for full searches (not quick suggestions)
                        // Note: For quick suggestions, we trust the Kick search's isLive status
                        // because it comes from authoritative sources (getPublicChannel, top streams)
                        if (shouldVerify) {
                            channels = await filterVerifiedChannels(channels, 'kick');
                        }

                        console.log(`[SearchHandler] Kick final: ${channels.length} channels`);
                        return { platform: 'kick' as Platform, data: channels };
                    })().catch(err => {
                        console.warn('⚠️ Failed to search Kick channels:', err);
                        return { platform: 'kick' as Platform, data: [] };
                    })
                );
            }

            // Execute all searches in parallel
            const results = await Promise.all(searchPromises);

            // Log results per platform
            for (const r of results) {
                console.log(`[SearchHandler] Platform ${r.platform} returned ${r.data.length} channels`);
            }

            if (!params.platform) {
                const allChannels = results.flatMap(r => r.data);
                console.log(`[SearchHandler] Combined total: ${allChannels.length} channels`);

                // Sort by: Live status first, then relevance (Exact match -> Starts with -> Others)
                allChannels.sort((a, b) => {
                    const aName = a.username.toLowerCase();
                    const bName = b.username.toLowerCase();
                    const aDisplay = a.displayName.toLowerCase();
                    const bDisplay = b.displayName.toLowerCase();
                    const q = normalizedQuery;

                    // 1. Live channels first
                    if (a.isLive && !b.isLive) return -1;
                    if (!a.isLive && b.isLive) return 1;

                    // 2. Exact matches
                    const aExact = aName === q || aDisplay === q;
                    const bExact = bName === q || bDisplay === q;
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;

                    // 3. Starts with query
                    const aStarts = aName.startsWith(q) || aDisplay.startsWith(q);
                    const bStarts = bName.startsWith(q) || bDisplay.startsWith(q);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;

                    return 0;
                });

                console.log(`[SearchHandler] Returning ${allChannels.length} channels (limit: ${params.limit})`);
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

                    // Filter channels - validate and remove invalid/own accounts
                    let validChannels = channelResult.data.filter(isValidChannel);
                    if (twitchUser) {
                        validChannels = validChannels.filter(c => {
                            const matchesUser = c.username.toLowerCase() === twitchUser.login.toLowerCase();
                            if (matchesUser) {
                                return normalizedQuery === twitchUser.login.toLowerCase();
                            }
                            return true;
                        });
                    }

                    // Verify channels exist via Twitch API (filters deleted accounts)
                    const verifiedTwitchChannels = await filterVerifiedChannels(validChannels, 'twitch');
                    results.channels.push(...verifiedTwitchChannels);

                    // Add live streams from verified channels
                    const liveChannels = verifiedTwitchChannels.filter(c => c.isLive);
                    results.streams.push(...liveChannels.map(c => ({ ...c, platform: 'twitch' })));

                    results.categories.push(...categoryResult.data);
                } catch (err) {
                    console.warn('⚠️ Failed to search Twitch:', err);
                }
            }

            if (!params.platform || params.platform === 'kick') {
                try {
                    const searchResult = await kickClient.search(params.query);

                    if (searchResult.channels) {
                        // Filter out invalid/deleted channels
                        let channels = searchResult.channels
                            .map(c => ({ ...c, platform: 'kick' }))
                            .filter(isValidChannel);

                        if (kickUser) {
                            channels = channels.filter(c => {
                                const matchesUser = c.username.toLowerCase() === kickUser.slug.toLowerCase();
                                if (matchesUser) {
                                    return normalizedQuery === kickUser.slug.toLowerCase();
                                }
                                return true;
                            });
                        }

                        // Verify channels exist via Kick API (filters deleted accounts)
                        const verifiedKickChannels = await filterVerifiedChannels(channels, 'kick');
                        results.channels.push(...verifiedKickChannels);
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
