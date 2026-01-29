/**
 * Platform Client Interface
 *
 * Defines the common interface that all platform API clients must implement.
 * This allows the app to work with streams, channels, and chat in a platform-agnostic way.
 */

import type { Platform } from '../../../shared/auth-types';

import type {
    UnifiedStream,
    UnifiedChannel,
    UnifiedCategory,
    UnifiedUser,
    UnifiedFollow,
    UnifiedVideo,
    UnifiedClip,
    SearchResults,
    PaginationParams,
    ApiResponse,
} from './platform-types';

/**
 * Base interface for all platform API clients
 */
export interface IPlatformClient {
    readonly platform: Platform;

    // ========== Authentication ==========

    /**
     * Check if the client is authenticated
     */
    isAuthenticated(): boolean;

    /**
     * Get the current authenticated user
     */
    getCurrentUser(): Promise<ApiResponse<UnifiedUser>>;

    // ========== Streams ==========

    /**
     * Get live streams from followed channels
     */
    getFollowedStreams(params?: PaginationParams): Promise<ApiResponse<SearchResults<UnifiedStream>>>;

    /**
     * Get top/featured live streams
     */
    getTopStreams(params?: PaginationParams): Promise<ApiResponse<SearchResults<UnifiedStream>>>;

    /**
     * Get streams by category/game
     */
    getStreamsByCategory(
        categoryId: string,
        params?: PaginationParams
    ): Promise<ApiResponse<SearchResults<UnifiedStream>>>;

    /**
     * Get a specific stream by channel
     */
    getStream(channelId: string): Promise<ApiResponse<UnifiedStream | null>>;

    // ========== Channels ==========

    /**
     * Get channel info by username/slug
     */
    getChannelByName(username: string): Promise<ApiResponse<UnifiedChannel>>;

    /**
     * Get channel info by ID
     */
    getChannelById(channelId: string): Promise<ApiResponse<UnifiedChannel>>;

    /**
     * Search for channels
     */
    searchChannels(
        query: string,
        params?: PaginationParams
    ): Promise<ApiResponse<SearchResults<UnifiedChannel>>>;

    // ========== Categories/Games ==========

    /**
     * Get top categories/games
     */
    getTopCategories(params?: PaginationParams): Promise<ApiResponse<SearchResults<UnifiedCategory>>>;

    /**
     * Search for categories/games
     */
    searchCategories(
        query: string,
        params?: PaginationParams
    ): Promise<ApiResponse<SearchResults<UnifiedCategory>>>;

    /**
     * Get category by ID
     */
    getCategoryById(categoryId: string): Promise<ApiResponse<UnifiedCategory>>;

    // ========== Follows ==========

    /**
     * Get user's followed channels
     */
    getFollowedChannels(params?: PaginationParams): Promise<ApiResponse<SearchResults<UnifiedFollow>>>;

    /**
     * Check if user follows a channel
     */
    isFollowing(channelId: string): Promise<ApiResponse<boolean>>;

    /**
     * Follow a channel (requires auth)
     */
    followChannel(channelId: string): Promise<ApiResponse<void>>;

    /**
     * Unfollow a channel (requires auth)
     */
    unfollowChannel(channelId: string): Promise<ApiResponse<void>>;

    // ========== Videos/VODs ==========

    /**
     * Get videos for a channel
     */
    getChannelVideos(
        channelId: string,
        params?: PaginationParams
    ): Promise<ApiResponse<SearchResults<UnifiedVideo>>>;

    /**
     * Get a specific video
     */
    getVideo(videoId: string): Promise<ApiResponse<UnifiedVideo>>;

    // ========== Clips ==========

    /**
     * Get clips for a channel
     */
    getChannelClips(
        channelId: string,
        params?: PaginationParams
    ): Promise<ApiResponse<SearchResults<UnifiedClip>>>;

    /**
     * Get a specific clip
     */
    getClip(clipId: string): Promise<ApiResponse<UnifiedClip>>;

    // ========== Stream URLs ==========

    /**
     * Get the stream playback URL for a channel
     * This is platform-specific and may require special handling
     */
    getStreamUrl(channelId: string): Promise<ApiResponse<StreamPlaybackInfo>>;
}

/**
 * Stream playback information
 */
export interface StreamPlaybackInfo {
    url: string;
    type: 'hls' | 'dash' | 'webrtc' | 'embed';
    qualities?: StreamQuality[];
}

export interface StreamQuality {
    name: string;
    resolution: string;
    bitrate?: number;
    url: string;
}

/**
 * Factory function type for creating platform clients
 */
export type PlatformClientFactory = (accessToken?: string) => IPlatformClient;
