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

// Cache for display name lookups to avoid redundant requests
const _displayNameCache = new Map<string, { displayName: string; avatar: string; timestamp: number }>();
const DISPLAY_NAME_CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_CACHE_SIZE = 1000; // Limit cache to 1000 entries

// Periodically clean expired entries to prevent memory leaks
// Using .unref() so the interval doesn't prevent graceful shutdown
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of _displayNameCache.entries()) {
        if (now - value.timestamp >= DISPLAY_NAME_CACHE_TTL) {
            _displayNameCache.delete(key);
        }
    }
    // Also enforce max size by removing oldest entries
    if (_displayNameCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(_displayNameCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, _displayNameCache.size - MAX_CACHE_SIZE);
        toRemove.forEach(([key]) => _displayNameCache.delete(key));
    }
}, 1000 * 60 * 5).unref(); // Clean every 5 minutes

/**
 * Lightweight function to fetch just display name and avatar for a channel
 * Uses net.request (fast) instead of BrowserWindow (slow)
 */
async function getChannelDisplayInfo(slug: string): Promise<{ displayName: string; avatar: string } | null> {
    // Check cache first
    const cached = _displayNameCache.get(slug.toLowerCase());
    if (cached && (Date.now() - cached.timestamp < DISPLAY_NAME_CACHE_TTL)) {
        return { displayName: cached.displayName, avatar: cached.avatar };
    }

    try {
        const { net } = require('electron');

        const data = await new Promise<any>((resolve, reject) => {
            const request = net.request({
                method: 'GET',
                url: `${KICK_LEGACY_API_V1_BASE}/channels/${slug}`,
            });

            request.setHeader('Accept', 'application/json');
            request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            request.setHeader('Referer', 'https://kick.com/');

            const timeout = setTimeout(() => {
                request.abort();
                resolve(null);
            }, 3000); // 3 second timeout

            request.on('response', (response: any) => {
                if (response.statusCode !== 200) {
                    clearTimeout(timeout);
                    resolve(null);
                    return;
                }

                let body = '';
                response.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                response.on('end', () => {
                    clearTimeout(timeout);
                    try {
                        resolve(JSON.parse(body));
                    } catch {
                        resolve(null);
                    }
                });
            });

            request.on('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });

            request.end();
        });

        if (!data) return null;

        const result = {
            displayName: data.user?.username || slug,
            avatar: data.user?.profile_pic || ''
        };

        // Cache the result
        _displayNameCache.set(slug.toLowerCase(), { ...result, timestamp: Date.now() });

        return result;
    } catch {
        return null;
    }
}

/**
 * Get stream info using the public/legacy API (No Auth Required)
 * Includes retry logic for transient server errors (502, 503, 504)
 */
export async function getPublicStreamBySlug(slug: string): Promise<UnifiedStream | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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

                    // Transient server errors - should retry
                    if (response.statusCode === 502 || response.statusCode === 503 || response.statusCode === 504) {
                        reject(new Error(`TRANSIENT:${response.statusCode}`));
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
                tags: (livestream.custom_tags && livestream.custom_tags.length > 0) ? livestream.custom_tags : (livestream.tags || []),
                isMature: livestream.is_mature ?? false,
                categoryId: livestream.categories?.[0]?.id?.toString() || '',
                categoryName: livestream.categories?.[0]?.name || '',
            };
        } catch (error: any) {
            lastError = error;

            // Check if this is a transient error that should be retried
            if (error.message?.startsWith('TRANSIENT:')) {
                const statusCode = error.message.split(':')[1];
                // Don't delay after the final attempt
                if (attempt < maxRetries - 1) {
                    const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
                    console.debug(`[KickStream] Got ${statusCode} for ${slug}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
                continue;
            }

            // Non-transient error - don't retry
            break;
        }
    }

    // All retries exhausted or non-transient error
    if (lastError) {
        console.warn(`Failed to fetch public Kick stream ${slug}:`, lastError);
    }
    return null;
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
                        if (users.length > 0) {
                            if (users[0].profile_picture) {
                                stream.channelAvatar = users[0].profile_picture;
                            }
                            if (users[0].name) {
                                stream.channelDisplayName = users[0].name;
                            }
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
                                } catch {
                                    resolve(null);
                                }
                            } else {
                                resolve(null);
                            }
                        });
                    });

                    request.on('error', () => {
                        clearTimeout(timeout);
                        resolve(null);
                    });

                    request.end();
                });

                if (data) {
                    const rawList = Array.isArray(data) ? data : (data.data || data.livestreams || []);

                    if (rawList.length > bestCount) {
                        bestData = data;
                        bestCount = rawList.length;
                    }

                    // If we got a good number of streams, stop trying
                    if (rawList.length >= 50) {
                        break;
                    }
                }
            } catch {
                // Ignore fetch errors, try next endpoint
            }
        }

        if (!bestData) {
            return { data: [] };
        }

        const streams: UnifiedStream[] = [];

        // Handle different response formats
        const rawList = Array.isArray(bestData) ? bestData : (bestData.data || bestData.livestreams || []);

        for (const item of rawList) {
            // Basic validation - handle different response structures
            const slug = item.slug || item.channel?.slug || item.broadcaster_username;
            if (!item || !slug) continue;

            // Extract thumbnail URL - different endpoints use different field structures
            const thumbnailUrl =
                item.thumbnail?.url ||
                item.thumbnail?.src ||
                item.thumbnail_url ||
                (typeof item.thumbnail === 'string' ? item.thumbnail : '') ||
                item.livestream?.thumbnail?.url ||
                '';

            // Extract avatar URL - different endpoints use different field structures  
            const avatarUrl =
                item.user?.profile_pic ||
                item.user?.profile_picture ||
                item.channel?.user?.profile_pic ||
                item.channel?.user?.profile_picture ||
                item.profile_picture ||
                '';

            streams.push({
                id: (item.id || item.session_id || '').toString(),
                platform: 'kick',
                channelId: (item.channel_id || item.broadcaster_user_id || item.user_id || '').toString(),
                channelName: slug,
                channelDisplayName: item.user?.username || item.channel?.user?.username || item.broadcaster_display_name || item.broadcaster_name || item.broadcaster_username || slug,
                channelAvatar: avatarUrl,
                title: item.session_title || item.title || '',
                viewerCount: item.viewer_count ?? item.viewers ?? 0,
                thumbnailUrl: thumbnailUrl,
                isLive: true,
                startedAt: item.created_at || item.start_time || new Date().toISOString(),
                language: item.language || language,
                tags: (item.custom_tags && item.custom_tags.length > 0) ? item.custom_tags : (item.tags || []),
                isMature: item.is_mature ?? item.has_mature_content ?? false,
                categoryId: (item.category_id || item.category?.id || '').toString(),
                categoryName: item.category?.name || '',
            });
        }


        // Manual filter and sort since this endpoint is a "dump"
        if (options.limit && streams.length > options.limit) {
            streams.length = options.limit; // Truncate
        }

        return { data: streams };

    } catch {
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
            if (user) {
                if (user.profile_picture) {
                    stream.channelAvatar = user.profile_picture;
                }
                if (user.name) {
                    stream.channelDisplayName = user.name;
                }
            }
            return stream;
        });

        // If we couldn't enrich with user data (unauthenticated or rate limited),
        // the display names will still be lowercase slugs. 
        // Fetch individual channel data which has properly capitalized display names.
        if (userMap.size === 0 && streams.length > 0) {
            try {
                // Get unique slugs that need enrichment
                const uniqueSlugs = [...new Set(streams.map(s => s.channelName))];

                // Fetch channel data in parallel (batch of 15 for speed)
                const displayNameMap = new Map<string, { displayName: string; avatar: string }>();
                const batchSize = 15;

                for (let i = 0; i < uniqueSlugs.length; i += batchSize) {
                    const batch = uniqueSlugs.slice(i, i + batchSize);
                    const results = await Promise.all(
                        batch.map(async (slug) => {
                            const info = await getChannelDisplayInfo(slug);
                            if (info) {
                                return { slug, ...info };
                            }
                            return null;
                        })
                    );

                    for (const result of results) {
                        if (result && result.displayName) {
                            displayNameMap.set(result.slug.toLowerCase(), {
                                displayName: result.displayName,
                                avatar: result.avatar || ''
                            });
                        }
                    }
                }

                // Enrich streams with properly capitalized display names and avatars
                for (const stream of streams) {
                    const data = displayNameMap.get(stream.channelName.toLowerCase());
                    if (data) {
                        if (data.displayName && data.displayName !== stream.channelName) {
                            stream.channelDisplayName = data.displayName;
                        }
                        if (data.avatar && !stream.channelAvatar) {
                            stream.channelAvatar = data.avatar;
                        }
                    }
                }
            } catch {
                // Silently ignore enrichment failures - streams will just have lowercase names
            }
        }

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
