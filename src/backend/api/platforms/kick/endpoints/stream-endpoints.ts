import { KickRequestor } from '../kick-requestor';
import { UnifiedStream } from '../../../unified/platform-types';
import {
    KickApiResponse,
    KickApiLivestream,
    PaginationOptions,
    PaginatedResult,
    KICK_LEGACY_API_V1_BASE
} from '../kick-types';
import { transformKickLivestream } from '../kick-transformers';
import { getUsersById } from './user-endpoints';
import { getChannel, getPublicChannel } from './channel-endpoints';

let _topStreamsCache: { data: UnifiedStream[]; timestamp: number } | null = null;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Get stream info using the public/legacy API (No Auth Required)
 */
export async function getPublicStreamBySlug(slug: string): Promise<UnifiedStream | null> {
    try {
        const { net } = require('electron');

        const data = await new Promise<any>((resolve, reject) => {
            const request = net.request({
                method: 'GET',
                url: `${KICK_LEGACY_API_V1_BASE}/channels/${slug}`,
            });

            request.setHeader('Accept', 'application/json');
            request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            request.setHeader('Referer', 'https://kick.com/');
            request.setHeader('X-Requested-With', 'XMLHttpRequest');

            request.on('response', (response: any) => {
                if (response.statusCode === 404) {
                    resolve(null);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Status ${response.statusCode}`));
                    return;
                }

                let body = '';
                response.on('data', (chunk: Buffer) => {
                    body += chunk.toString();
                });

                response.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        console.warn(`[KickStream] Failed to parse JSON for ${slug}`);
                        reject(new Error('Failed to parse JSON'));
                    }
                });
            });

            request.on('error', (error: Error) => {
                reject(error);
            });

            request.end();
        });

        if (!data) return null;

        const livestream = data.livestream;
        if (!livestream) return null;

        // Map legacy livestream to UnifiedStream
        return {
            id: livestream.id.toString(),
            platform: 'kick',
            channelId: livestream.channel_id.toString(),
            channelName: data.slug,
            channelDisplayName: data.user?.username || data.slug,
            channelAvatar: data.user?.profile_pic || '',
            title: livestream.session_title || '',
            viewerCount: livestream.viewer_count ?? livestream.viewers ?? 0,
            thumbnailUrl: livestream.thumbnail?.url || '',
            isLive: true,
            startedAt: livestream.created_at,
            language: livestream.language || 'en',
            tags: livestream.tags || [],
            categoryId: livestream.categories?.[0]?.id?.toString() || '',
            categoryName: livestream.categories?.[0]?.name || '',
        };
    } catch (error) {
        console.warn(`Failed to fetch public Kick stream ${slug}:`, error);
        return null;
    }
}

/**
 * Get livestream by channel slug
 */
export async function getStreamBySlug(client: KickRequestor, slug: string): Promise<UnifiedStream | null> {
    // Try official API first (using App or User token)
    try {
        const channel = await getChannel(client, slug);
        if (channel && channel.isLive) {
            // Need to get full stream data from livestreams endpoint
            try {
                const response = await client.request<KickApiResponse<KickApiLivestream[]>>(
                    `/livestreams?broadcaster_user_id=${channel.id}`
                );
                if (response.data && response.data.length > 0) {
                    const stream = transformKickLivestream(response.data[0]);

                    // Enrich with user avatar
                    try {
                        const users = await getUsersById(client, [parseInt(stream.channelId)]);
                        if (users.length > 0 && users[0].profile_picture) {
                            stream.channelAvatar = users[0].profile_picture;
                        }
                    } catch (e) {
                        // Ignore user fetch errors
                    }

                    return stream;
                }
            } catch (error) {
                console.error('Failed to fetch Kick stream details:', error);
            }
        }
    } catch (e) {
        console.warn('Official API lookup failed for stream, falling back to public:', e);
    }

    // Fallback to public/legacy API if official fails or returns no live stream (maybe public API has better cache?)
    return getPublicStreamBySlug(slug);
}

/**
 * Get top streams using the legacy public API
 * Uses Electron's net module to bypass CORS and Cloudflare protection
 * Tries multiple endpoints for better coverage
 */
export async function getPublicTopStreams(
    options: PaginationOptions & { categoryId?: string; language?: string } = {}
): Promise<PaginatedResult<UnifiedStream>> {
    try {
        const { net } = require('electron');
        const language = options.language || 'en';

        // Try multiple endpoints - some may be blocked or return limited data
        const endpoints = [
            `https://kick.com/stream/livestreams/${language}`,
            `https://kick.com/stream/featured-livestreams/${language}`,
            `https://api.kick.com/private/v1/livestreams`,
        ];

        let bestData: any = null;
        let bestCount = 0;

        for (const url of endpoints) {
            try {
                const data = await new Promise<any>((resolve) => {
                    const request = net.request({
                        method: 'GET',
                        url: url,
                    });

                    request.setHeader('Accept', 'application/json');
                    request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    request.setHeader('Referer', 'https://kick.com/');
                    request.setHeader('Origin', 'https://kick.com');
                    request.setHeader('X-Requested-With', 'XMLHttpRequest');

                    // Timeout after 5 seconds
                    const timeout = setTimeout(() => {
                        request.abort();
                        resolve(null);
                    }, 5000);

                    request.on('response', (response: any) => {
                        let body = '';
                        response.on('data', (chunk: Buffer) => {
                            body += chunk.toString();
                        });
                        response.on('end', () => {
                            clearTimeout(timeout);
                            if (response.statusCode === 200) {
                                try {
                                    const parsed = JSON.parse(body);
                                    resolve(parsed);
                                } catch (e) {
                                    if (body.trim().startsWith('<')) {
                                        console.warn(`[KickStreams] ${url} returned HTML (bot protection)`);
                                    }
                                    resolve(null);
                                }
                            } else {
                                console.log(`[KickStreams] ${url} returned ${response.statusCode}`);
                                resolve(null);
                            }
                        });
                    });

                    request.on('error', (error: Error) => {
                        clearTimeout(timeout);
                        console.log(`[KickStreams] ${url} error:`, error.message);
                        resolve(null);
                    });

                    request.end();
                });

                if (data) {
                    // Check how many items this endpoint returned
                    const rawList = Array.isArray(data) ? data : (data.data || data.livestreams || []);
                    console.log(`[KickStreams] ${url} returned ${rawList.length} streams`);

                    if (rawList.length > bestCount) {
                        bestData = data;
                        bestCount = rawList.length;
                    }

                    // If we got a good number of streams, stop trying
                    if (rawList.length >= 50) {
                        break;
                    }
                }
            } catch (e) {
                console.log(`[KickStreams] Error fetching ${url}`);
            }
        }

        if (!bestData) {
            console.log('[KickStreams] All endpoints failed, returning empty');
            return { data: [] };
        }

        const streams: UnifiedStream[] = [];

        // Handle different response formats
        const rawList = Array.isArray(bestData) ? bestData : (bestData.data || bestData.livestreams || []);
        console.log(`[KickStreams] Processing ${rawList.length} streams from best endpoint`);

        for (const item of rawList) {
            // Basic validation - handle different response structures
            const slug = item.slug || item.channel?.slug || item.broadcaster_username;
            if (!item || !slug) continue;

            streams.push({
                id: (item.id || item.session_id || '').toString(),
                platform: 'kick',
                channelId: (item.channel_id || item.broadcaster_user_id || item.user_id || '').toString(),
                channelName: slug,
                channelDisplayName: item.user?.username || item.channel?.user?.username || item.broadcaster_username || slug,
                channelAvatar: item.user?.profile_pic || item.channel?.user?.profile_pic || '',
                title: item.session_title || item.title || '',
                viewerCount: item.viewer_count ?? item.viewers ?? 0,
                thumbnailUrl: item.thumbnail?.url || item.thumbnail_url || '',
                isLive: true,
                startedAt: item.created_at || item.start_time || new Date().toISOString(),
                language: item.language || language,
                tags: item.tags || [],
                categoryId: (item.category_id || item.category?.id || '').toString(),
                categoryName: item.category?.name || '',
            });
        }

        console.log(`[KickStreams] Parsed ${streams.length} valid streams`);

        // Manual filter and sort since this endpoint is a "dump"
        if (options.limit && streams.length > options.limit) {
            streams.length = options.limit; // Truncate
        }

        return { data: streams };

    } catch (error) {
        console.warn('Failed to fetch public kick streams (web fallback):', error);
        return { data: [] };
    }
}

/**
 * Get top/featured live streams
 * https://docs.kick.com/apis/livestreams - GET /public/v1/livestreams
 */
export async function getTopStreams(
    client: KickRequestor,
    options: PaginationOptions & { categoryId?: string; language?: string } = {}
): Promise<PaginatedResult<UnifiedStream>> {
    try {
        const params = new URLSearchParams();

        if (options.limit) {
            params.set('limit', options.limit.toString());
        }
        if (options.categoryId) {
            params.set('category_id', options.categoryId);
        }
        if (options.language) {
            params.set('language', options.language);
        }
        // Default sort by viewer count (highest first)
        params.set('sort', 'viewer_count');

        const queryString = params.toString();
        const endpoint = queryString ? `/livestreams?${queryString}` : '/livestreams';

        const response = await client.request<KickApiResponse<KickApiLivestream[]>>(endpoint);
        const rawStreams = response.data || [];

        // Fetch avatars
        // Note: With App Token, getting users might fail if we hit rate limits or if it requires user scope
        // But /users endpoint usually works with App Token for public profiles
        const userIds = rawStreams.map(s => s.broadcaster_user_id);

        let userMap = new Map<number, any>();
        try {
            // Only fetch if we have streams
            if (userIds.length > 0) {
                const users = await getUsersById(client, userIds);
                userMap = new Map(users.map(u => [u.user_id, u]));
            }
        } catch (e) {
            console.warn('Failed to fetch user avatars for streams:', e);
        }

        const streams = rawStreams.map(s => {
            const stream = transformKickLivestream(s);
            const user = userMap.get(s.broadcaster_user_id);
            if (user && user.profile_picture) {
                stream.channelAvatar = user.profile_picture;
            }
            return stream;
        });

        return {
            data: streams,
        };
    } catch (error) {
        console.warn('Failed to fetch Kick top streams via official API, falling back to public:', error);
        // Fallback to public API on error
        return getPublicTopStreams(options);
    }
}

/**
 * Get or fetch valid cached top streams for fuzzy search
 */
export async function getTopStreamsCached(client: KickRequestor): Promise<UnifiedStream[]> {
    const now = Date.now();
    if (
        _topStreamsCache &&
        (now - _topStreamsCache.timestamp < CACHE_TTL) &&
        _topStreamsCache.data.length > 0
    ) {
        return _topStreamsCache.data;
    }

    try {
        // Only try official API if authenticated to avoid 429 rate limits
        if (client.isAuthenticated()) {
            try {
                const result = await getTopStreams(client, { limit: 100 });
                if (result.data.length > 0) {
                    _topStreamsCache = {
                        data: result.data,
                        timestamp: now
                    };
                    return result.data;
                }
            } catch (e) {
                console.warn('Official API top streams failed, trying fallback');
            }
        }

        // Fallback to public API
        const publicResult = await getPublicTopStreams({ limit: 100 });
        if (publicResult.data.length > 0) {
            _topStreamsCache = {
                data: publicResult.data,
                timestamp: now
            };
        }
        return publicResult.data;
    } catch (e) {
        console.warn('Failed to refresh top streams cache', e);
        // Return stale cache if available, otherwise empty
        return _topStreamsCache?.data || [];
    }
}

/**
 * Get streams by category
 * https://docs.kick.com/apis/livestreams - GET /public/v1/livestreams?category_id=:id
 */
export async function getStreamsByCategory(
    client: KickRequestor,
    categoryId: string,
    options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedStream>> {
    return getTopStreams(client, { ...options, categoryId });
}

/**
 * Get followed streams (live channels the user follows)
 * Note: Official API doesn't have a direct followed streams endpoint
 */
export async function getFollowedStreams(
    client: KickRequestor,
    _options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedStream>> {
    // The official API doesn't have a followed streams endpoint
    // Would need to first get followed channels, then check which are live
    console.warn('⚠️ Kick official API does not support followed streams directly');
    return { data: [] };
}
