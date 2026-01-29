import { UnifiedVideo } from '../../../unified/platform-types'; // Assuming this type exists or will use generic format
import { KickRequestor } from '../kick-requestor';
import {
    KickLegacyApiVideo,
    PaginationOptions,
    PaginatedResult,
    KICK_LEGACY_API_V2_BASE
} from '../kick-types';

/**
 * Get videos by channel slug using legacy API
 */
export async function getVideosByChannelSlug(
    slug: string,
    options: PaginationOptions = {}
): Promise<PaginatedResult<any>> { // Using any for now to map to UI
    try {
        const { net } = require('electron');
        const limit = options.limit || 20;
        const cursor = options.cursor || 0;
        // Map sort option: 'views' -> 'view', 'date' -> 'date' (Kick API uses 'view' not 'views')
        const sortParam = options.sort === 'views' ? 'view' : 'date';

        // Switch to V2 API to match clips implementation
        const url = `${KICK_LEGACY_API_V2_BASE}/channels/${slug}/videos?cursor=${cursor}&limit=${limit}&sort=${sortParam}`;

        const data = await new Promise<any>((resolve, reject) => {
            const request = net.request({
                method: 'GET',
                url: url,
            });

            request.setHeader('Accept', 'application/json');
            request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            request.setHeader('Referer', 'https://kick.com/');
            request.setHeader('X-Requested-With', 'XMLHttpRequest');

            request.on('response', (response: any) => {
                if (response.statusCode === 404) {
                    resolve([]);
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
                        console.warn(`[KickVideo] Failed to parse JSON for ${slug}`);
                        reject(new Error('Failed to parse JSON'));
                    }
                });
            });

            request.on('error', (error: Error) => {
                reject(error);
            });

            request.end();
        });

        let videos: any[] = [];
        let nextCursor: string | undefined;

        if (Array.isArray(data)) {
            videos = data;
            // For V2 endpoint returning standard array, next cursor is often just offset + limit
            // But if there's no wrapper with nextCursor, we have to infer or keep it basic.
            // Let's assume pagination by offset if data is an array
            nextCursor = videos.length > 0 ? (parseInt(cursor.toString()) + videos.length).toString() : undefined;
        } else {
            videos = data.videos || [];
            nextCursor = data.nextCursor;
        }

        return {
            data: videos.map((v: any) => {
                // A VOD without a source URL is subscriber-only content
                const hasSource = Boolean(v.source);
                const isSubOnly = !hasSource && !v.is_live;

                return {
                    id: v.id.toString(),
                    uuid: v.uuid || v.video?.uuid || '', // UUID needed for api/v1/video/{uuid} endpoint
                    slug: v.slug || '', // Video slug for URL construction
                    title: v.session_title || v.title || `Stream ${v.id}`,
                    duration: v.duration ? formatDuration(v.duration) : '0:00',
                    views: (v.views || v.view_count || '0').toString(),
                    date: new Date(v.created_at).toISOString(),
                    created_at: v.created_at, // Raw ISO date for consistency
                    thumbnailUrl: v.thumbnail?.src || v.thumbnail?.url || v.thumbnail_url || v.thumb || v.video?.thumb || '',
                    source: v.source || '', // Direct HLS m3u8 URL - this is the most reliable way to play VODs
                    url: v.source || `https://kick.com/video/${v.slug}`,
                    platform: 'kick',
                    isLive: v.is_live,
                    isSubOnly, // Flag for subscriber-only VODs
                    // Include channel info for metadata
                    channelSlug: v.channel?.slug || v.livestream?.channel?.slug || '',
                    channelName: v.channel?.user?.username || v.livestream?.channel?.user?.username || '',
                    channelAvatar: v.channel?.user?.profile_pic || v.livestream?.channel?.user?.profile_pic || null,
                    // Category info - check multiple possible locations
                    category: v.categories?.[0]?.name || v.category?.name || v.livestream?.categories?.[0]?.name || v.livestream?.session_title || '',
                    // Language info
                    language: v.language || v.livestream?.language || ''
                };
            }),
            cursor: nextCursor
        };

    } catch (error) {
        console.warn(`Failed to fetch videos for ${slug}:`, error);
        return { data: [] };
    }
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const formattedSecs = s.toString().padStart(2, '0');

    if (h > 0) {
        const formattedMins = m.toString().padStart(2, '0');
        return `${h}:${formattedMins}:${formattedSecs}`;
    }
    return `${m}:${formattedSecs}`;
}
