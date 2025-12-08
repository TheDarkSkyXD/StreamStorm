/**
 * Twitch API Client
 *
 * Client for interacting with the Twitch Helix API.
 * Handles authentication, rate limiting, and automatic token refresh.
 */

import type { TwitchUser, AuthToken } from '../../../../shared/auth-types';
import { getOAuthConfig } from '../../../auth/oauth-config';
import { twitchAuthService } from '../../../auth/twitch-auth';
import { storageService } from '../../../services/storage-service';
import type { UnifiedStream, UnifiedChannel, UnifiedCategory } from '../../unified/platform-types';
import {
    TWITCH_API_BASE,
    type TwitchApiUser,
    type TwitchApiStream,
    type TwitchApiChannel,
    type TwitchApiGame,
    type TwitchApiFollowedChannel,
    type TwitchApiResponse,
    type TwitchApiSearchChannel,
    type TwitchApiVideo,
    type TwitchApiClip,
} from './twitch-types';
import {
    transformTwitchStream,
    transformTwitchChannel,
    transformTwitchCategory,
    transformTwitchSearchChannel,
} from './twitch-transformers';

// ========== Types ==========

export interface PaginationOptions {
    first?: number; // Number of results (max 100)
    after?: string; // Cursor for next page
    before?: string; // Cursor for previous page
}

export interface PaginatedResult<T> {
    data: T[];
    cursor?: string;
    total?: number;
}

export interface TwitchClientError {
    status: number;
    message: string;
    retryAfter?: number;
}

// ========== Twitch API Client Class ==========

class TwitchClient {
    private readonly baseUrl = TWITCH_API_BASE;
    private config = getOAuthConfig('twitch');

    /**
     * Make an authenticated request to the Twitch API
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        // Ensure we have a valid token
        const hasValidToken = await twitchAuthService.ensureValidToken();
        if (!hasValidToken) {
            throw new Error('Not authenticated with Twitch');
        }

        const token = storageService.getToken('twitch');
        if (!token) {
            throw new Error('No Twitch access token available');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${token.accessToken}`,
            'Client-Id': this.config.clientId,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
                const error: TwitchClientError = {
                    status: 429,
                    message: 'Rate limited by Twitch API',
                    retryAfter,
                };
                console.warn(`⚠️ Twitch API rate limited, retry after ${retryAfter}s`);
                throw error;
            }

            // Handle unauthorized (try token refresh)
            if (response.status === 401) {
                console.log('🔄 Token expired, refreshing...');
                const refreshed = await twitchAuthService.refreshToken();
                if (refreshed) {
                    // Retry the request with new token
                    return this.request<T>(endpoint, options);
                }
                throw new Error('Authentication failed');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    (errorData as { message?: string }).message ||
                    `Twitch API error: ${response.status}`
                );
            }

            return (await response.json()) as T;
        } catch (error) {
            console.error(`❌ Twitch API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // ========== User Endpoints ==========

    /**
     * Get the currently authenticated user
     */
    async getUser(): Promise<TwitchUser | null> {
        try {
            const data = await this.request<TwitchApiResponse<TwitchApiUser>>('/users');
            if (data.data && data.data.length > 0) {
                const apiUser = data.data[0];
                return {
                    id: apiUser.id,
                    login: apiUser.login,
                    displayName: apiUser.display_name,
                    profileImageUrl: apiUser.profile_image_url,
                    email: apiUser.email,
                    createdAt: apiUser.created_at,
                    broadcasterType: apiUser.broadcaster_type,
                };
            }
            return null;
        } catch (error) {
            console.error('❌ Failed to get Twitch user:', error);
            return null;
        }
    }

    /**
     * Get users by their IDs
     */
    async getUsersById(ids: string[]): Promise<TwitchUser[]> {
        if (ids.length === 0) return [];
        if (ids.length > 100) {
            throw new Error('Cannot fetch more than 100 users at once');
        }

        const queryString = ids.map((id) => `id=${id}`).join('&');
        const data = await this.request<TwitchApiResponse<TwitchApiUser>>(
            `/users?${queryString}`
        );

        return data.data.map((u) => ({
            id: u.id,
            login: u.login,
            displayName: u.display_name,
            profileImageUrl: u.profile_image_url,
            email: u.email,
            createdAt: u.created_at,
            broadcasterType: u.broadcaster_type,
        }));
    }

    /**
     * Get users by their login names
     */
    async getUsersByLogin(logins: string[]): Promise<TwitchUser[]> {
        if (logins.length === 0) return [];
        if (logins.length > 100) {
            throw new Error('Cannot fetch more than 100 users at once');
        }

        const queryString = logins.map((login) => `login=${login}`).join('&');
        const data = await this.request<TwitchApiResponse<TwitchApiUser>>(
            `/users?${queryString}`
        );

        return data.data.map((u) => ({
            id: u.id,
            login: u.login,
            displayName: u.display_name,
            profileImageUrl: u.profile_image_url,
            email: u.email,
            createdAt: u.created_at,
            broadcasterType: u.broadcaster_type,
        }));
    }

    // ========== Followed Channels ==========

    /**
     * Get channels followed by the authenticated user
     */
    async getFollowedChannels(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedChannel>> {
        const user = await this.getUser();
        if (!user) {
            throw new Error('Must be authenticated to get followed channels');
        }

        const params = new URLSearchParams({
            user_id: user.id,
            first: String(options.first || 100),
        });

        if (options.after) {
            params.set('after', options.after);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiFollowedChannel>>(
            `/channels/followed?${params.toString()}`
        );

        // Get full channel info for each followed channel
        const channelIds = data.data.map((f) => f.broadcaster_id);
        const channels = await this.getChannelsById(channelIds);

        return {
            data: channels,
            cursor: data.pagination?.cursor,
            total: data.total,
        };
    }

    /**
     * Get all followed channels (handles pagination automatically)
     */
    async getAllFollowedChannels(): Promise<UnifiedChannel[]> {
        const allChannels: UnifiedChannel[] = [];
        let cursor: string | undefined;

        do {
            const result = await this.getFollowedChannels({ after: cursor, first: 100 });
            allChannels.push(...result.data);
            cursor = result.cursor;
        } while (cursor);

        return allChannels;
    }

    // ========== Streams ==========

    /**
     * Get live streams for specific user IDs
     */
    async getStreamsByUserIds(
        userIds: string[],
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        if (userIds.length === 0) return { data: [] };
        if (userIds.length > 100) {
            throw new Error('Cannot fetch more than 100 streams at once');
        }

        const params = new URLSearchParams({
            first: String(options.first || 100),
        });

        userIds.forEach((id) => params.append('user_id', id));

        if (options.after) {
            params.set('after', options.after);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiStream>>(
            `/streams?${params.toString()}`
        );

        return {
            data: data.data.map(transformTwitchStream),
            cursor: data.pagination?.cursor,
        };
    }

    /**
     * Get live streams for followed channels
     */
    async getFollowedStreams(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        const user = await this.getUser();
        if (!user) {
            throw new Error('Must be authenticated to get followed streams');
        }

        const params = new URLSearchParams({
            user_id: user.id,
            first: String(options.first || 100),
        });

        if (options.after) {
            params.set('after', options.after);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiStream>>(
            `/streams/followed?${params.toString()}`
        );

        return {
            data: data.data.map(transformTwitchStream),
            cursor: data.pagination?.cursor,
        };
    }

    /**
     * Get top live streams
     */
    async getTopStreams(
        options: PaginationOptions & { gameId?: string; language?: string } = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        const params = new URLSearchParams({
            first: String(options.first || 20),
        });

        if (options.after) {
            params.set('after', options.after);
        }
        if (options.gameId) {
            params.set('game_id', options.gameId);
        }
        if (options.language) {
            params.set('language', options.language);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiStream>>(
            `/streams?${params.toString()}`
        );

        return {
            data: data.data.map(transformTwitchStream),
            cursor: data.pagination?.cursor,
        };
    }

    /**
     * Get a specific stream by user login
     */
    async getStreamByLogin(login: string): Promise<UnifiedStream | null> {
        const params = new URLSearchParams({ user_login: login });
        const data = await this.request<TwitchApiResponse<TwitchApiStream>>(
            `/streams?${params.toString()}`
        );

        if (data.data && data.data.length > 0) {
            return transformTwitchStream(data.data[0]);
        }
        return null;
    }

    // ========== Channels ==========

    /**
     * Get channel information by broadcaster IDs
     */
    async getChannelsById(ids: string[]): Promise<UnifiedChannel[]> {
        if (ids.length === 0) return [];
        if (ids.length > 100) {
            throw new Error('Cannot fetch more than 100 channels at once');
        }

        const params = new URLSearchParams();
        ids.forEach((id) => params.append('broadcaster_id', id));

        const data = await this.request<TwitchApiResponse<TwitchApiChannel>>(
            `/channels?${params.toString()}`
        );

        // Get user info for profile images (raw API format)
        const userQueryString = ids.map((id) => `id=${id}`).join('&');
        const userData = await this.request<TwitchApiResponse<TwitchApiUser>>(
            `/users?${userQueryString}`
        );
        const userMap = new Map(userData.data.map((u) => [u.id, u]));

        return data.data.map((channel) => {
            const apiUser = userMap.get(channel.broadcaster_id);
            return transformTwitchChannel(channel, apiUser);
        });
    }

    /**
     * Search for channels
     */
    async searchChannels(
        query: string,
        options: PaginationOptions & { liveOnly?: boolean } = {}
    ): Promise<PaginatedResult<UnifiedChannel>> {
        const params = new URLSearchParams({
            query,
            first: String(options.first || 20),
        });

        if (options.after) {
            params.set('after', options.after);
        }
        if (options.liveOnly !== undefined) {
            params.set('live_only', String(options.liveOnly));
        }

        const data = await this.request<TwitchApiResponse<TwitchApiSearchChannel>>(
            `/search/channels?${params.toString()}`
        );

        // Transform search results to unified channels
        const channels: UnifiedChannel[] = data.data.map(transformTwitchSearchChannel);

        return {
            data: channels,
            cursor: data.pagination?.cursor,
        };
    }

    // ========== Categories/Games ==========

    /**
     * Get top categories/games
     */
    async getTopCategories(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedCategory>> {
        const params = new URLSearchParams({
            first: String(options.first || 20),
        });

        if (options.after) {
            params.set('after', options.after);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiGame>>(
            `/games/top?${params.toString()}`
        );

        return {
            data: data.data.map(transformTwitchCategory),
            cursor: data.pagination?.cursor,
        };
    }

    /**
     * Search for categories/games
     */
    async searchCategories(
        query: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedCategory>> {
        const params = new URLSearchParams({
            query,
            first: String(options.first || 20),
        });

        if (options.after) {
            params.set('after', options.after);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiGame>>(
            `/search/categories?${params.toString()}`
        );

        return {
            data: data.data.map(transformTwitchCategory),
            cursor: data.pagination?.cursor,
        };
    }

    /**
     * Get category/game by ID
     */
    async getCategoryById(id: string): Promise<UnifiedCategory | null> {
        const data = await this.request<TwitchApiResponse<TwitchApiGame>>(
            `/games?id=${id}`
        );

        if (data.data && data.data.length > 0) {
            return transformTwitchCategory(data.data[0]);
        }
        return null;
    }

    // ========== Videos ==========

    /**
     * Get videos by user ID
     */
    async getVideosByUser(
        userId: string,
        options: PaginationOptions & { type?: 'archive' | 'highlight' | 'upload' } = {}
    ): Promise<PaginatedResult<TwitchApiVideo>> {
        const params = new URLSearchParams({
            user_id: userId,
            first: String(options.first || 20),
        });

        if (options.after) {
            params.set('after', options.after);
        }
        if (options.type) {
            params.set('type', options.type);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiVideo>>(
            `/videos?${params.toString()}`
        );

        return {
            data: data.data,
            cursor: data.pagination?.cursor,
        };
    }

    // ========== Clips ==========

    /**
     * Get clips by broadcaster ID
     */
    async getClipsByBroadcaster(
        broadcasterId: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<TwitchApiClip>> {
        const params = new URLSearchParams({
            broadcaster_id: broadcasterId,
            first: String(options.first || 20),
        });

        if (options.after) {
            params.set('after', options.after);
        }

        const data = await this.request<TwitchApiResponse<TwitchApiClip>>(
            `/clips?${params.toString()}`
        );

        return {
            data: data.data,
            cursor: data.pagination?.cursor,
        };
    }

    // ========== Utility Methods ==========

    /**
     * Check if the client is authenticated
     */
    isAuthenticated(): boolean {
        return twitchAuthService.isAuthenticated();
    }

    /**
     * Get the current access token
     */
    getAccessToken(): string | null {
        return twitchAuthService.getAccessToken();
    }
}

// ========== Export Singleton ==========

export const twitchClient = new TwitchClient();
