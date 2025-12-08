import { KickRequestor } from '../kick-requestor';
import { UnifiedChannel, UnifiedStream } from '../../../unified/platform-types';
import { PaginationOptions, PaginatedResult } from '../kick-types';
import { getPublicChannel, getChannel } from './channel-endpoints';
import { getTopStreamsCached, getStreamBySlug } from './stream-endpoints';
import { searchCategories } from './category-endpoints';

/**
 * Search for channels (using categories search + livestreams)
 * Note: Official API doesn't have a direct channel search endpoint
 */
export async function searchChannels(
    client: KickRequestor,
    query: string,
    _options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedChannel>> {
    // Kick official API doesn't support fuzzy channel search.
    // Strategy:
    // 1. Exact match: Try to find a channel by exact slug using Public API.
    // 2. Public Search: Use unofficial search endpoint (fuzzy & offline).
    // 3. Official Exact match: Try via authenticated API (redundancy).
    // 4. Fuzzy match (Live): Fetch top streams and filter by slug/name (Official API).

    const results = new Map<string, UnifiedChannel>();
    const normalizedQuery = query.toLowerCase().trim();

    // 1. Try exact slug match (Public API - No Auth)
    try {
        console.log(`[KickSearch] Step 1: Checking exact slug match for "${normalizedQuery}"`);
        const channel = await getPublicChannel(normalizedQuery);
        if (channel) {
            console.log(`[KickSearch] Step 1: Found channel "${channel.username}"`);
            results.set(channel.id, channel);
        } else {
            console.log(`[KickSearch] Step 1: No channel found for "${normalizedQuery}"`);
        }
    } catch (e) {
        console.warn(`[KickSearch] Step 1: Error fetching public channel "${normalizedQuery}"`, e);
    }

    // 2. Try public search endpoint (Unofficial - Works for offline & fuzzy)
    // Endpoint: https://kick.com/api/search/channel?term=query
    // Use Electron's net module to bypass CORS and some bot protections
    try {
        console.log(`[KickSearch] Step 2: Querying public search endpoint for "${normalizedQuery}"`);

        const data = await new Promise<any[]>((resolve, reject) => {
            const { net } = require('electron');
            const request = net.request({
                method: 'GET',
                url: `https://kick.com/api/search/channel?term=${encodeURIComponent(normalizedQuery)}`,
            });

            request.setHeader('Accept', 'application/json');
            request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            request.setHeader('Referer', 'https://kick.com/');
            request.setHeader('X-Requested-With', 'XMLHttpRequest');

            request.on('response', (response: any) => {
                let body = '';
                response.on('data', (chunk: Buffer) => {
                    body += chunk.toString();
                });
                response.on('end', () => {
                    if (response.statusCode === 200) {
                        try {
                            const parsed = JSON.parse(body);
                            resolve(parsed);
                        } catch (e) {
                            // Common case: 200 OK but body is cloudflare HTML
                            if (body.trim().startsWith('<')) {
                                console.warn(`[KickSearch] Step 2: Search endpoint returned HTML (likely bot protection). Skipping.`);
                            } else {
                                console.warn(`[KickSearch] Step 2: Failed to parse JSON. Body start: ${body.substring(0, 100)}`);
                            }
                            resolve([]);
                        }
                    } else {
                        reject(new Error(`Status ${response.statusCode}`));
                    }
                });
            });

            request.on('error', (error: Error) => {
                reject(error);
            });

            request.end();
        });

        if (Array.isArray(data)) {
            console.log(`[KickSearch] Step 2: Found ${data.length} results`);
            for (const item of data) {
                if (item.slug && item.id) {
                    const channelId = item.id.toString();
                    if (!results.has(channelId)) {
                        console.log(`[KickSearch] Step 2: Found channel "${item.slug}"`);
                        results.set(channelId, {
                            id: channelId,
                            platform: 'kick',
                            username: item.slug,
                            displayName: item.username || item.user?.username || item.slug,
                            avatarUrl: item.type === 'livestream' ? (item.thumbnail?.url || item.thumbnail_url) : (item.user?.profile_pic || item.profile_pic || ''),
                            bannerUrl: '',
                            bio: '',
                            isLive: item.is_live || false,
                            isVerified: item.verified || false,
                            isPartner: false,
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.warn(`[KickSearch] Step 2: Error querying public search endpoint`, e);
    }

    // 3. Try official exact slug match (Official API - Requires Auth)
    if (client.isAuthenticated()) {
        try {
            console.log(`[KickSearch] Step 3: Checking official API for "${normalizedQuery}"`);
            const channel = await getChannel(client, normalizedQuery);
            if (channel) {
                console.log(`[KickSearch] Step 3: Found channel "${channel.username}"`);
                results.set(channel.id, channel);
            }
        } catch (e) {
            console.warn(`[KickSearch] Step 3: Error fetching official channel "${normalizedQuery}"`, e);
        }
    }

    // 4. Try to get fuzzy matches from Top Streams
    // This helps find live channels even if the query is partial or fuzzy.
    try {
        console.log(`[KickSearch] Step 4: Checking top streams for fuzzy match`);
        const topStreams = await getTopStreamsCached(client);
        console.log(`[KickSearch] Step 4: Found ${topStreams.length} top streams to filter`);

        for (const stream of topStreams) {
            const chName = stream.channelName.toLowerCase();
            const chDisp = stream.channelDisplayName.toLowerCase();

            if (chName.includes(normalizedQuery) || chDisp.includes(normalizedQuery)) {
                if (!results.has(stream.channelId)) {
                    console.log(`[KickSearch] Step 4: Found fuzzy match "${stream.channelName}" in text`);
                    results.set(stream.channelId, {
                        id: stream.channelId,
                        platform: 'kick',
                        username: stream.channelName,
                        displayName: stream.channelDisplayName,
                        avatarUrl: stream.channelAvatar,
                        bannerUrl: '',
                        bio: '',
                        isLive: true,
                        isVerified: false,
                        isPartner: false,
                    });
                }
            }
        }
    } catch (e) {
        console.warn('Failed to fetch top streams for search fallback', e);
    }

    const finalResults = Array.from(results.values());
    console.log(`[KickSearch] Final results for "${query}": ${finalResults.length} channels`);
    return { data: finalResults };
}

/**
 * Full search across channels, categories, streams, videos, and clips
 * Note: Limited by official API capabilities
 */
export async function search(
    client: KickRequestor,
    query: string
): Promise<{ channels: any[]; categories: any[]; streams: any[]; videos: any[]; clips: any[] }> {
    const categoriesResult = await searchCategories(client, query);
    const channelsResult = await searchChannels(client, query);

    // If we found channels, check if they are live and get their stream info
    const streams: UnifiedStream[] = [];

    // Kick search currently only supports exact slug match, so channelsResult will likely have 0 or 1 item
    for (const channel of channelsResult.data) {
        if (channel.isLive) {
            // Since we already have the channel, we could optimize this, 
            // but getStreamBySlug handles the /livestreams fetch and transformation
            const stream = await getStreamBySlug(client, channel.username);
            if (stream) {
                streams.push(stream);
            }
        }
    }

    return {
        channels: channelsResult.data,
        categories: categoriesResult.data,
        streams,
        videos: [],
        clips: [],
    };
}
