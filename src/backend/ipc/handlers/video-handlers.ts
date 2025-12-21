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

                console.log(`[TwitchClip] Fetching clips for User ID: ${userId}`);
                const clips = await twitchClient.getClipsByBroadcaster(userId, {
                    first: params.limit,
                    after: params.cursor
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
                console.log(`[KickClip] Fetching clips for channel: ${params.channelName}`);
                const clips = await kickClient.getClips(params.channelName, {
                    limit: params.limit,
                    cursor: params.cursor,
                    sort: params.sort // Pass sort to Kick API
                });
                const count = clips.data ? clips.data.length : 0;
                console.log(`[KickClip] Fetched ${count} clips for ${params.channelName}`);

                // Pre-check VOD availability for each clip
                // Fetch channel videos and create a set of available livestream IDs
                if (clips.data && clips.data.length > 0) {
                    try {
                        console.log(`[KickClip] Pre-checking VOD availability for ${count} clips`);
                        const videos = await kickClient.getVideos(params.channelName, {
                            limit: 100 // Fetch enough videos to match recent clips
                        });

                        // Create a set of available video IDs using centralized helper
                        const availableVodIds = new Set<string>();
                        if (videos.data) {
                            for (const video of videos.data) {
                                const vodId = getKickVideoLivestreamId(video);
                                if (vodId) {
                                    availableVodIds.add(vodId);
                                }
                            }
                        }
                        console.log(`[KickClip] Found ${availableVodIds.size} available VODs`);

                        // Update each clip's vodId based on availability
                        clips.data = clips.data.map((clip: any) => {
                            const hasVod = clip.vodId && availableVodIds.has(clip.vodId.toString());
                            if (!hasVod && clip.vodId) {
                                console.log(`[KickClip] VOD not available for clip: ${clip.id} (livestream_id: ${clip.vodId})`);
                            }
                            return {
                                ...clip,
                                vodId: hasVod ? clip.vodId : '' // Clear vodId if VOD doesn't exist
                            };
                        });
                    } catch (vodCheckError) {
                        console.warn('[KickClip] Could not pre-check VOD availability:', vodCheckError);
                        // Continue without VOD check - clips will still have vodId set
                    }
                }

                // Apply client-side sorting (as fallback since Kick API may not reliably sort by views)
                if (clips.data && clips.data.length > 0 && params.sort === 'views') {
                    console.log(`[KickClip] Sorting ${clips.data.length} clips by views (client-side)`);
                    clips.data = [...clips.data].sort((a: any, b: any) => {
                        const viewsA = parseInt(a.views) || 0;
                        const viewsB = parseInt(b.views) || 0;
                        return viewsB - viewsA; // Descending (most views first)
                    });
                }

                return { success: true, ...clips };
            }
            throw new Error(`Unsupported platform: ${params.platform}`);
        } catch (error) {
            console.error('❌ Failed to get clips:', error);
            return {
                success: false,
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
            throw new Error(`Unsupported platform: ${params.platform}`);
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
            console.log(`[KickVodLookup] Looking up VOD for livestream_id: ${params.livestreamId} on channel: ${params.channelSlug}`);

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
                        console.log(`[KickVodLookup] Found matching VOD:`, video.id, video.title);

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

            console.log(`[KickVodLookup] VOD not found for livestream_id: ${params.livestreamId}`);
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
