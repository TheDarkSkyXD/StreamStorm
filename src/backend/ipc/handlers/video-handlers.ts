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

                return {
                    success: true,
                    data: videos.data.map(v => ({
                        id: v.id,
                        title: v.title,
                        duration: formatTwitchDuration(v.duration),
                        views: v.view_count.toString(),
                        date: new Date(v.created_at).toISOString(),
                        thumbnailUrl: v.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180'),
                        platform: 'twitch'
                    })),
                    cursor: videos.cursor,
                    debug: `User ID: ${userId}, Count: ${videos.data.length}`
                };

            } else if (params.platform === 'kick') {
                const videos = await kickClient.getVideos(params.channelName, {
                    limit: params.limit,
                    cursor: params.cursor // Use cursor now for V2
                });
                // Check if videos.data exists before logging length
                const count = videos.data ? videos.data.length : 0;

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

                return {
                    success: true,
                    data: clips.data.map(c => ({
                        id: c.id,
                        title: c.title,
                        duration: formatSeconds(c.duration),
                        views: c.view_count.toString(),
                        date: new Date(c.created_at).toISOString(),
                        thumbnailUrl: c.thumbnail_url,
                        embedUrl: c.embed_url,
                        url: c.url,
                        platform: 'twitch',
                        gameName: c.game_id
                    })),
                    cursor: clips.cursor
                };

            } else if (params.platform === 'kick') {
                console.log(`[KickClip] Fetching clips for channel: ${params.channelName}`);
                const clips = await kickClient.getClips(params.channelName, {
                    limit: params.limit,
                    cursor: params.cursor
                });
                const count = clips.data ? clips.data.length : 0;
                console.log(`[KickClip] Fetched ${count} clips for ${params.channelName}`);
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
}
