import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { Platform } from '../../../shared/auth-types';
import { TwitchStreamResolver } from '../../api/platforms/twitch/twitch-stream-resolver';
import { KickStreamResolver } from '../../api/platforms/kick/kick-stream-resolver';

// Instances
const twitchResolver = new TwitchStreamResolver();
const kickResolver = new KickStreamResolver();

// Helper to format Twitch duration string "1h2m30s" -> "1:02:30"
function formatTwitchDuration(duration: string): string {
    if (!duration) return '0:00';

    const hoursMatch = duration.match(/(\d+)h/);
    const minsMatch = duration.match(/(\d+)m/);
    const secsMatch = duration.match(/(\d+)s/);

    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1]) : 0;
    const secs = secsMatch ? parseInt(secsMatch[1]) : 0;

    const formattedSecs = secs.toString().padStart(2, '0');

    if (hours > 0) {
        const formattedMins = mins.toString().padStart(2, '0');
        return `${hours}:${formattedMins}:${formattedSecs}`;
    }

    return `${mins}:${formattedSecs}`;
}

// Helper to format seconds -> "1:02:30" or "2:30"
function formatSeconds(seconds: number): string {
    const duration = Math.round(seconds);
    const hours = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = duration % 60;

    const formattedSecs = secs.toString().padStart(2, '0');

    if (hours > 0) {
        const formattedMins = mins.toString().padStart(2, '0');
        return `${hours}:${formattedMins}:${formattedSecs}`;
    }

    return `${mins}:${formattedSecs}`;
}

/**
 * Get the livestream ID from a Kick video object, trying multiple field names
 * This centralizes the logic for matching clips to VODs
 */
function getKickVideoLivestreamId(video: any): string | undefined {
    const id = video.livestreamId || video.live_stream_id || video.id;
    return id ? id.toString() : undefined;
}

export function registerVideoHandlers(): void {
    /**
     * Get playback URL for a VOD
     */
    ipcMain.handle(IPC_CHANNELS.VIDEOS_GET_PLAYBACK_URL, async (_event, params: {
        platform: Platform;
        videoId: string;
    }) => {
        try {
            if (params.platform === 'twitch') {
                const result = await twitchResolver.getVodPlaybackUrl(params.videoId);
                return { success: true, data: result };
            } else if (params.platform === 'kick') {
                const result = await kickResolver.getVodPlaybackUrl(params.videoId);
                return { success: true, data: result };
            }
            throw new Error(`Unsupported platform: ${params.platform}`);
        } catch (error) {
            console.error('❌ Failed to get VOD playback URL:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to resolve VOD URL'
            };
        }
    });

    /**
     * Get metadata for a VOD
     */
    ipcMain.handle(IPC_CHANNELS.VIDEOS_GET_METADATA, async (_event, params: {
        platform: Platform;
        videoId: string;
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');

        try {
            if (params.platform === 'twitch') {
                const video = await twitchClient.getVideoById(params.videoId);
                if (!video) {
                    return { success: false, error: 'Video not found' };
                }

                // Get user info for the channel
                const users = await twitchClient.getUsersById([video.user_id]);
                const user = users[0];

                return {
                    success: true,
                    data: {
                        id: video.id,
                        title: video.title,
                        channelId: video.user_id,
                        channelName: video.user_login,
                        channelDisplayName: video.user_name,
                        channelAvatar: user?.profileImageUrl || null,
                        views: video.view_count,
                        duration: formatTwitchDuration(video.duration),
                        createdAt: video.created_at,
                        thumbnailUrl: video.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180'),
                        description: video.description,
                        type: video.type,
                        platform: 'twitch'
                    }
                };
            } else if (params.platform === 'kick') {
                const metadata = await kickResolver.getVideoMetadata(params.videoId);
                return {
                    success: true,
                    data: metadata
                };
            }

            throw new Error(`Unsupported platform: ${params.platform}`);
        } catch (error) {
            console.error('❌ Failed to get video metadata:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch video metadata'
            };
        }
    });


    /**
     * Get videos by channel
     */
    ipcMain.handle(IPC_CHANNELS.VIDEOS_GET_BY_CHANNEL, async (_event, params: {
        platform: Platform;
        channelName: string; // Keep for backward compat, used if channelId missing
        channelId?: string; // New: preferred way to lookup
        limit?: number;
        cursor?: string;
        sort?: 'date' | 'views'; // Sort option: 'date' (most recent) or 'views'
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            if (params.platform === 'twitch') {
                let userId = params.channelId;

                if (!userId) {
                    // Fallback to lookup by name
                    console.log(`[TwitchVideo] Fetching user for channel: ${params.channelName}`);
                    const users = await twitchClient.getUsersByLogin([params.channelName.toLowerCase()]);
                    if (!users.length) {
                        console.error(`[TwitchVideo] Channel not found: ${params.channelName}`);
                        throw new Error('Channel not found');
                    }
                    userId = users[0].id;
                }

                console.log(`[TwitchVideo] Fetching videos for User ID: ${userId}`);

                const videos = await twitchClient.getVideosByUser(userId, {
                    first: params.limit,
                    after: params.cursor
                    // type: 'archive' // Removed to show all video types (uplods, highlights, archives)
                });
                console.log(`[TwitchVideo] Fetched ${videos.data.length} videos for ${params.channelName} (User ID: ${userId})`);

                // Sort by views if requested (Twitch API doesn't support views sort)
                let sortedVideos = videos.data;
                if (params.sort === 'views') {
                    sortedVideos = [...videos.data].sort((a, b) => b.view_count - a.view_count);
                }

                // Resolve Game Info via GQL (since Helix videos endpoint doesn't return game_id)
                const videoIds = videos.data.map(v => v.id);
                let gameMap: Record<string, { id: string, name: string }> = {};

                if (videoIds.length > 0) {
                    try {
                        gameMap = await twitchClient.getVideosGameData(videoIds);
                    } catch (err) {
                        console.error('[TwitchVideo] Failed to resolve game data via GQL:', err);
                    }
                }

                // Fallback logic for game IDs if they somehow exist (e.g. from a different endpoint in future)
                // This preserves the previous logic just in case, but prefers GQL result

                const mappedData = sortedVideos.map(v => {
                    const gqlGame = gameMap[v.id];
                    const gameName = gqlGame?.name || v.game_name;
                    const gameId = gqlGame?.id || v.game_id;

                    return {
                        id: v.id,
                        title: v.title,
                        duration: formatTwitchDuration(v.duration),
                        views: v.view_count.toString(),
                        date: new Date(v.created_at).toISOString(),
                        created_at: v.created_at, // Raw ISO date
                        thumbnailUrl: v.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180'),
                        platform: 'twitch',
                        gameName: gameName,
                        category: gameName,
                        language: v.language
                    };
                });


                return {
                    success: true,
                    data: mappedData,
                    cursor: videos.cursor,
                    debug: `User ID: ${userId}, Count: ${videos.data.length}`
                };

            } else if (params.platform === 'kick') {
                const videos = await kickClient.getVideos(params.channelName, {
                    limit: params.limit,
                    cursor: params.cursor, // Use cursor now for V2
                    sort: params.sort // Pass sort to Kick API
                });
                // Check if videos.data exists before logging length
                const count = videos.data ? videos.data.length : 0;

                // Apply client-side sorting (as fallback since Kick API may not reliably sort by views)
                if (videos.data && videos.data.length > 0 && params.sort === 'views') {
                    console.log(`[KickVideo] Sorting ${videos.data.length} videos by views (client-side)`);
                    videos.data = [...videos.data].sort((a: any, b: any) => {
                        const viewsA = parseInt(a.views) || 0;
                        const viewsB = parseInt(b.views) || 0;
                        return viewsB - viewsA; // Descending (most views first)
                    });
                }

                return {
                    success: true,
                    ...videos,
                    debug: `Kick Channel: ${params.channelName}, Count: ${count}`
                };
            }
            throw new Error(`Unsupported platform: ${params.platform}`);
        } catch (error) {
            console.error('❌ Failed to get videos:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch videos'
            };
        }
    });


    /**
     * Get clips by channel
     */
    ipcMain.handle(IPC_CHANNELS.CLIPS_GET_BY_CHANNEL, async (_event, params: {
        platform: Platform;
        channelName: string;
        channelId?: string;
        limit?: number;
        cursor?: string;
        sort?: 'date' | 'views'; // Sort option: 'date' (most recent) or 'views'
        timeRange?: 'day' | 'week' | 'month' | 'all';
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            if (params.platform === 'twitch') {
                let userId = params.channelId;

                if (!userId) {
                    const users = await twitchClient.getUsersByLogin([params.channelName.toLowerCase()]);
                    if (!users.length) throw new Error('Channel not found');
                    userId = users[0].id;
                }

                // Calculate started_at based on timeRange
                let startedAt: string | undefined;
                if (params.timeRange && params.timeRange !== 'all') {
                    const now = new Date();
                    switch (params.timeRange) {
                        case 'day':
                            now.setDate(now.getDate() - 1);
                            break;
                        case 'week':
                            now.setDate(now.getDate() - 7);
                            break;
                        case 'month':
                            now.setMonth(now.getMonth() - 1);
                            break;
                    }
                    startedAt = now.toISOString();
                }

                console.log(`[TwitchClip] Fetching clips for User ID: ${userId} with timeRange: ${params.timeRange || 'all'} (startedAt: ${startedAt || 'none'})`);
                const clips = await twitchClient.getClipsByBroadcaster(userId, {
                    first: params.limit,
                    after: params.cursor,
                    started_at: startedAt
                });
                console.log(`[TwitchClip] Fetched ${clips.data.length} clips for ${params.channelName}`);

                // Sort by views if requested (Twitch clips API doesn't support views sort for broadcaster endpoint)
                let sortedClips = clips.data;
                if (params.sort === 'views') {
                    sortedClips = [...clips.data].sort((a, b) => b.view_count - a.view_count);
                }

                // Resolve Game IDs to Names
                const gameIds = [...new Set(sortedClips.map(c => c.game_id).filter(id => id))];
                let gameMap: Record<string, string> = {};

                if (gameIds.length > 0) {
                    try {
                        const games = await twitchClient.getCategoriesByIds(gameIds);
                        gameMap = games.reduce((acc, game) => {
                            acc[game.id] = game.name;
                            return acc;
                        }, {} as Record<string, string>);
                    } catch (err) {
                        console.error('[TwitchClip] Failed to resolve game names:', err);
                    }
                }

                return {
                    success: true,
                    data: sortedClips.map(c => ({
                        id: c.id,
                        title: c.title,
                        duration: formatSeconds(c.duration),
                        views: c.view_count.toString(),
                        date: new Date(c.created_at).toISOString(),
                        created_at: c.created_at, // Raw ISO date
                        thumbnailUrl: c.thumbnail_url,
                        embedUrl: c.embed_url,
                        url: c.url,
                        platform: 'twitch',
                        gameName: gameMap[c.game_id] || c.game_id || '',
                        language: c.language,
                        // VOD availability - empty string means VOD is no longer available
                        vodId: c.video_id || ''
                    })),
                    cursor: clips.cursor
                };

            } else if (params.platform === 'kick') {
                // Strategy: Multi-page fetch to cover the time range
                const isViewSortWithTimeParams = params.sort === 'views' && params.timeRange && params.timeRange !== 'all';
                let clipsData: any[] = [];
                let outputCursor: string | undefined = undefined;

                if (isViewSortWithTimeParams) {
                    console.log(`[KickClip] executing "Deep Fetch" strategy for ${params.timeRange} view sort`);

                    // Determine cutoff date
                    const now = new Date();
                    let cutoffDate = new Date(0);
                    switch (params.timeRange) {
                        case 'day': cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
                        case 'week': cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
                        case 'month': cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
                    }

                    // Loop fetch
                    let currentCursor = params.cursor;
                    let keepFetching = true;
                    let pagesFetched = 0;
                    const MAX_PAGES = 30; // Increased to 30 pages to cover more history (potential 3000 clips)

                    while (keepFetching && pagesFetched < MAX_PAGES) {
                        console.log(`[KickClip] Deep Fetch Page ${pagesFetched + 1} (cursor: ${currentCursor})`);
                        const response = await kickClient.getClips(params.channelName, {
                            limit: 100,
                            cursor: currentCursor,
                            sort: 'date',
                            timeRange: params.timeRange
                        });

                        const pageClips = response.data || [];
                        const count = pageClips.length;

                        if (count === 0) {
                            console.log('[KickClip] Page empty, stopping fetch');
                            keepFetching = false;
                        } else {
                            clipsData.push(...pageClips);
                            currentCursor = response.cursor;
                            pagesFetched++;

                            // Log date range of this page
                            const firstDate = pageClips[0].created_at || pageClips[0].date;
                            const lastDate = pageClips[count - 1].created_at || pageClips[count - 1].date;
                            console.log(`[KickClip] Page ${pagesFetched} range: ${firstDate} -> ${lastDate}`);

                            // Check if current page has clips older than cutoff
                            const lastClipDate = new Date(lastDate);
                            if (lastClipDate < cutoffDate) {
                                console.log(`[KickClip] Reached cutoff date (${cutoffDate.toISOString()}), stopping.`);
                                keepFetching = false;
                            }

                            if (!currentCursor) {
                                console.log('[KickClip] No next cursor, stopping.');
                                keepFetching = false;
                            }
                        }
                    }

                    // Filter by Date
                    const beforeFilter = clipsData.length;
                    clipsData = clipsData.filter(c => {
                        const d = new Date(c.created_at || c.date);
                        return d >= cutoffDate;
                    });
                    console.log(`[KickClip] Deep Fetch Result: ${beforeFilter} -> ${clipsData.length} clips within ${params.timeRange}`);

                    // Sort by Views
                    console.log(`[KickClip] Sorting ${clipsData.length} clips by views...`);
                    clipsData.sort((a, b) => {
                        const vA = parseInt(String(a.views).replace(/,/g, ''), 10) || 0;
                        const vB = parseInt(String(b.views).replace(/,/g, ''), 10) || 0;
                        return vB - vA;
                    });

                    // Log top 5 for verification
                    clipsData.slice(0, 5).forEach((c, i) => {
                        console.log(`[KickClip] #${i + 1}: ${c.views} views - ${c.title}`);
                    });

                    // Optimization: For "Last Day" or any filtered view sort, if we found huge number of clips,
                    // satisfy the request by returning the top viewed ones.
                    // We only check VODs for the top 50 to save API calls.
                    // Since pagination is disabled in this mode (outputCursor = undefined), returning top 50 is reasonable
                    // or we return all but only VOD-check the top 50.
                    // Let's return all but prioritize top 50 for checking.


                    // For this mode, we effectively clear pagination since we fetched "everything relevant"
                    outputCursor = undefined;

                } else {
                    // Standard single page fetch
                    const response = await kickClient.getClips(params.channelName, {
                        limit: params.limit,
                        cursor: params.cursor,
                        sort: params.sort,
                        timeRange: params.timeRange
                    });
                    clipsData = response.data || [];
                    outputCursor = response.cursor;

                    // Client-side sort fallback if needed (e.g. All Time views sort)
                    if (params.sort === 'views' && clipsData.length > 0) {
                        clipsData.sort((a, b) => {
                            const viewsA = parseInt(String(a.views).replace(/,/g, ''), 10) || 0;
                            const viewsB = parseInt(String(b.views).replace(/,/g, ''), 10) || 0;
                            return viewsB - viewsA;
                        });
                    }
                }

                // VOD Availability Check (only for the clips we are returning)
                // Limit checking to top 50 to avoid massive API spam if list is huge
                const clipsToCheck = clipsData.slice(0, 50);

                if (clipsToCheck.length > 0) {
                    try {
                        const videos = await kickClient.getVideos(params.channelName, { limit: 50 });
                        const availableVodIds = new Set<string>();
                        if (videos.data) {
                            for (const video of videos.data) {
                                const vodId = getKickVideoLivestreamId(video);
                                if (vodId) availableVodIds.add(vodId);
                            }
                        }

                        // Update ALL clipsData (though only checked subset)
                        // If a clip wasn't in "clipsToCheck", we assume VOD might be there or just leave it?
                        // Actually, safely we map what we checked.
                        // Optimization: Just check set for all, assuming the 50 videos cover recent history.
                        // If we fetched deep history (1 month), the recent 50 videos might NOT cover it.
                        // But verifying 1-month old VODs requires fetching ALL videos... too expensive.
                        // We will just check against recent videos.

                        clipsData = clipsData.map((clip, index) => {
                            // Only verify clips we actually checked (top 50)
                            if (index >= 50) {
                                return clip; // Leave vodId as-is for unchecked clips
                            }
                            const hasVod = clip.vodId && availableVodIds.has(clip.vodId.toString());
                            return { ...clip, vodId: hasVod ? clip.vodId : '' };
                        });
                    } catch (e) {
                        console.warn('[KickClip] VOD check failed', e);
                    }
                }

                return {
                    success: true,
                    data: clipsData,
                    cursor: outputCursor
                };
            }
            throw new Error(`Unsupported platform: ${params.platform} `);
        } catch (error) {
            console.error('❌ Failed to get clips:', error);
            return {
                error: error instanceof Error ? error.message : 'Failed to fetch clips'
            };
        }
    });

    /**
     * Get playback URL for a clip
     */
    ipcMain.handle(IPC_CHANNELS.CLIPS_GET_PLAYBACK_URL, async (_event, params: {
        platform: Platform;
        clipId: string;
        thumbnailUrl?: string;
        clipUrl?: string;
    }) => {
        try {
            if (params.platform === 'twitch') {
                // Twitch clips use GQL to fetch the actual video URL by clip slug/ID
                const result = await twitchResolver.getClipPlaybackUrl(params.clipId);
                return { success: true, data: result };
            } else if (params.platform === 'kick') {
                // Kick clips have a direct video_url (passed as clipUrl)
                console.log('[KickClip] Playback request - clipId:', params.clipId);
                console.log('[KickClip] Playback request - clipUrl:', params.clipUrl);
                console.log('[KickClip] Playback request - thumbnailUrl:', params.thumbnailUrl);

                if (!params.clipUrl) {
                    console.error('[KickClip] No clipUrl provided for Kick clip playback');
                    throw new Error('Clip URL required for Kick clip playback');
                }

                console.log('[KickClip] Returning playback URL:', params.clipUrl);

                // Detect format based on URL - Kick clips use HLS (.m3u8)
                const format = params.clipUrl.includes('.m3u8') ? 'hls' : 'mp4';
                console.log('[KickClip] Detected format:', format);

                return {
                    success: true,
                    data: {
                        url: params.clipUrl,
                        format: format
                    }
                };
            }
            throw new Error(`Unsupported platform: ${params.platform} `);
        } catch (error) {
            console.error('❌ Failed to get clip playback URL:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to resolve clip URL'
            };
        }
    });

    /**
     * Get Kick VOD by livestream ID (for clip-to-VOD navigation)
     * Fetches the channel's videos and finds one with matching live_stream_id
     */
    ipcMain.handle(IPC_CHANNELS.VIDEOS_GET_BY_LIVESTREAM_ID, async (_event, params: {
        channelSlug: string;
        livestreamId: string;
    }) => {
        try {
            console.log(`[KickVodLookup] Looking up VOD for livestream_id: ${params.livestreamId} on channel: ${params.channelSlug} `);

            const { kickClient } = await import('../../api/platforms/kick/kick-client');

            // Fetch videos from the channel (may need multiple pages to find the VOD)
            let cursor: string | undefined;
            let attempts = 0;
            const maxAttempts = 5; // Limit to avoid infinite loops

            while (attempts < maxAttempts) {
                attempts++;
                const videos = await kickClient.getVideos(params.channelSlug, {
                    limit: 50,
                    cursor: cursor
                });

                if (!videos.data || videos.data.length === 0) {
                    break;
                }

                // Look for a video with matching livestream ID
                // The video data structure has live_stream_id from the raw API, but our mapped data might use different fields
                // We need to check against the livestreamId we're looking for
                for (const video of videos.data) {
                    // Use centralized helper for consistent ID extraction
                    const videoLivestreamId = getKickVideoLivestreamId(video);

                    if (videoLivestreamId && videoLivestreamId === params.livestreamId?.toString()) {
                        console.log(`[KickVodLookup] Found matching VOD: `, video.id, video.title);

                        // Return the video data with source URL for direct playback
                        // Include all metadata needed by the Video page
                        return {
                            success: true,
                            data: {
                                id: video.id,
                                uuid: video.uuid || '',
                                title: video.title,
                                source: video.source, // Direct HLS URL
                                thumbnailUrl: video.thumbnailUrl,
                                duration: video.duration,
                                views: video.views,
                                date: video.date,
                                channelSlug: video.channelSlug,
                                channelName: video.channelName || video.channelSlug || params.channelSlug,
                                channelDisplayName: video.channelName || video.channelSlug || params.channelSlug,
                                channelAvatar: video.channelAvatar || null,
                                category: video.category,
                                language: video.language || ''
                            }
                        };
                    }
                }

                // Continue to next page if available
                if (videos.cursor) {
                    cursor = videos.cursor;
                } else {
                    break;
                }
            }

            console.log(`[KickVodLookup] VOD not found for livestream_id: ${params.livestreamId} `);
            return {
                success: false,
                error: 'VOD not found - it may have been deleted or is not yet available'
            };

        } catch (error) {
            console.error('❌ Failed to lookup Kick VOD by livestream ID:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to lookup VOD'
            };
        }
    });
}
