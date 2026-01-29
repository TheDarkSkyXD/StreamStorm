/**
 * Twitch API Client
 *
 * Client for interacting with the Twitch Helix API.
 * Handles authentication, rate limiting, and automatic token refresh.
 */

import type { TwitchUser } from '../../../../shared/auth-types';
import type { UnifiedStream, UnifiedChannel, UnifiedCategory } from '../../unified/platform-types';


import * as CategoryEndpoints from './endpoints/category-endpoints';
import * as ChannelEndpoints from './endpoints/channel-endpoints';
import * as ClipEndpoints from './endpoints/clip-endpoints';
import * as SearchEndpoints from './endpoints/search-endpoints';
import * as StreamEndpoints from './endpoints/stream-endpoints';
import * as UserEndpoints from './endpoints/user-endpoints';
import * as VideoEndpoints from './endpoints/video-endpoints';
import { fetchGamesForVideos } from './twitch-gql-helpers';
import { TwitchRequestor } from './twitch-requestor';
import type {
    PaginatedResult,
    PaginationOptions,
    TwitchClientError,
    TwitchApiVideo,
    TwitchApiClip
} from './twitch-types';

// Re-export types for backward compatibility
export type { PaginationOptions, PaginatedResult, TwitchClientError };

// ========== Twitch API Client Class ==========

class TwitchClient extends TwitchRequestor {
    // ========== User Endpoints ==========

    /**
     * Get the currently authenticated user
     */
    async getUser(): Promise<TwitchUser | null> {
        return UserEndpoints.getUser(this);
    }

    /**
     * Get users by their IDs
     */
    async getUsersById(ids: string[]): Promise<TwitchUser[]> {
        return UserEndpoints.getUsersById(this, ids);
    }

    /**
     * Get users by their login names
     */
    async getUsersByLogin(logins: string[]): Promise<TwitchUser[]> {
        return UserEndpoints.getUsersByLogin(this, logins);
    }

    // ========== Followed Channels ==========

    /**
     * Get channels followed by the authenticated user
     */
    async getFollowedChannels(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedChannel>> {
        return UserEndpoints.getFollowedChannels(this, options);
    }

    /**
     * Get all followed channels (handles pagination automatically)
     */
    async getAllFollowedChannels(): Promise<UnifiedChannel[]> {
        return UserEndpoints.getAllFollowedChannels(this);
    }

    // ========== Streams ==========

    /**
     * Get live streams for specific user IDs
     */
    async getStreamsByUserIds(
        userIds: string[],
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        return StreamEndpoints.getStreamsByUserIds(this, userIds, options);
    }

    /**
     * Get live streams for followed channels
     */
    async getFollowedStreams(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        return StreamEndpoints.getFollowedStreams(this, options);
    }

    /**
     * Get top live streams
     */
    async getTopStreams(
        options: PaginationOptions & { gameId?: string; language?: string } = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        return StreamEndpoints.getTopStreams(this, options);
    }

    /**
     * Get a specific stream by user login
     */
    async getStreamByLogin(login: string): Promise<UnifiedStream | null> {
        return StreamEndpoints.getStreamByLogin(this, login);
    }

    // ========== Channels ==========

    /**
     * Get channel information by broadcaster IDs
     */
    async getChannelsById(ids: string[]): Promise<UnifiedChannel[]> {
        return ChannelEndpoints.getChannelsById(this, ids);
    }

    /**
     * Search for channels
     */
    async searchChannels(
        query: string,
        options: PaginationOptions & { liveOnly?: boolean } = {}
    ): Promise<PaginatedResult<UnifiedChannel>> {
        return SearchEndpoints.searchChannels(this, query, options);
    }

    // ========== Categories/Games ==========

/**
     * Get top categories/games
     */
    async getTopCategories(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedCategory>> {
        return CategoryEndpoints.getTopCategories(this, options);
    }

    /**
     * Get ALL top categories with automatic pagination (for browse page)
     * Fetches all pages until exhausted - no artificial limits
     */
    async getAllTopCategories(): Promise<UnifiedCategory[]> {
        return CategoryEndpoints.getAllTopCategories(this);
    }

    /**
     * Search for categories/games
     */
    async searchCategories(
        query: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedCategory>> {
        return SearchEndpoints.searchCategories(this, query, options);
    }

    /**
     * Get category/game by ID
     */
    async getCategoryById(id: string): Promise<UnifiedCategory | null> {
        return CategoryEndpoints.getCategoryById(this, id);
    }

    /**
     * Get categories/games by multiple IDs
     */
    async getCategoriesByIds(ids: string[]): Promise<UnifiedCategory[]> {
        return CategoryEndpoints.getCategoriesByIds(this, ids);
    }

    // ========== Videos ==========

    /**
     * Get videos by user ID
     */
    async getVideosByUser(
        userId: string,
        options: PaginationOptions & { type?: 'archive' | 'highlight' | 'upload' } = {}
    ): Promise<PaginatedResult<TwitchApiVideo>> {
        return VideoEndpoints.getVideosByUser(this, userId, options);
    }

    /**
     * Get a single video by ID
     */
    /**
     * Get a single video by ID
     */
    async getVideoById(videoId: string): Promise<TwitchApiVideo | null> {
        return VideoEndpoints.getVideoById(this, videoId);
    }

    /**
     * Get game/category data for videos via GQL
     */
    async getVideosGameData(videoIds: string[]): Promise<Record<string, { id: string; name: string }>> {
        return fetchGamesForVideos(videoIds);
    }

    // ========== Clips ==========

    /**
     * Get clips by broadcaster ID
     */
    async getClipsByBroadcaster(
        broadcasterId: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<TwitchApiClip>> {
        return ClipEndpoints.getClipsByBroadcaster(this, broadcasterId, options);
    }

    // ========== Utility Methods ==========
    // Inherited from TwitchRequestor: isAuthenticated, getAccessToken
}

// ========== Export Singleton ==========

export const twitchClient = new TwitchClient();
