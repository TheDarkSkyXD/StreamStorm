/**
 * Kick API Client
 *
 * Client for interacting with the official Kick Public API v1.
 * API Documentation: https://docs.kick.com/
 * 
 * Handles authentication and data fetching for stream discovery.
 */

import { kickAuthService } from '../../../auth/kick-auth';
import { storageService } from '../../../services/storage-service';
import { UnifiedStream, UnifiedChannel, UnifiedCategory, UnifiedClip } from '../../unified/platform-types';
import { KickUser } from '../../../../shared/auth-types';
import { KICK_API_BASE, KickApiUser, PaginationOptions, PaginatedResult } from './kick-types';
import { KickRequestor } from './kick-requestor';

// Re-export common types for compatibility
export type { PaginationOptions, PaginatedResult } from './kick-types';

// Import endpoints
import * as UserEndpoints from './endpoints/user-endpoints';
import * as ChannelEndpoints from './endpoints/channel-endpoints';
import * as StreamEndpoints from './endpoints/stream-endpoints';
import * as CategoryEndpoints from './endpoints/category-endpoints';
import * as SearchEndpoints from './endpoints/search-endpoints';
import * as VideoEndpoints from './endpoints/video-endpoints';
import * as ClipEndpoints from './endpoints/clip-endpoints';

// ========== Kick API Client Class ==========

class KickClient implements KickRequestor {
    readonly baseUrl = KICK_API_BASE;

    /**
     * Make an authenticated request to the official Kick Public API v1
     * All official endpoints require OAuth2 Bearer token
     */
    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        let token: string | null = null;
        let isAppToken = false;

        // 1. Try User Token first
        if (kickAuthService.isAuthenticated()) {
            await kickAuthService.ensureValidToken();
            token = kickAuthService.getAccessToken();
        }

        // 2. If no User Token, try App Token
        if (!token) {
            const hasAppToken = await kickAuthService.ensureValidAppToken();
            if (hasAppToken) {
                token = kickAuthService.getAppAccessToken();
                isAppToken = true;
            }
        }

        if (!token) {
            // If we still have no token, we can't make an official API request
            throw new Error('Not authenticated with Kick (User or App)');
        }

        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers as Record<string, string>,
        };

        const maxRetries = 3;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
                const response = await fetch(url, {
                    ...options,
                    headers,
                });

                if (!response.ok) {
                    if (response.status === 429) {
                        attempt++;
                        if (attempt > maxRetries) {
                            throw new Error(`Kick API error: 429 (Max retries exceeded)`);
                        }

                        // Calculate backoff: 1s, 2s, 4s...
                        // Use Retry-After header if available
                        const retryHeader = response.headers.get('Retry-After');
                        const backoff = retryHeader
                            ? parseInt(retryHeader, 10) * 1000
                            : 1000 * Math.pow(2, attempt - 1);

                        console.warn(`⚠️ Kick API 429 Too Many Requests. Retrying in ${backoff}ms (Attempt ${attempt}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        continue;
                    }

                    if (response.status === 403) {
                        console.warn('⚠️ Kick API forbidden - may need additional scopes or User Token');
                    }

                    if (response.status === 401) {
                        console.log(`🔄 Kick ${isAppToken ? 'App' : 'User'} token expired, refreshing...`);

                        if (!isAppToken) {
                            // Only attempt refresh for user tokens for now
                            // App tokens are handled by ensureValidAppToken check at start of next call
                            const refreshed = await kickAuthService.refreshToken();
                            if (refreshed) {
                                // Recursive call with fresh token (count as new attempt set)
                                return this.request<T>(endpoint, options);
                            }
                        }
                    }

                    throw new Error(`Kick API error: ${response.status}`);
                }

                return (await response.json()) as T;
            } catch (error: any) {
                // If it's a 429 error we deliberately threw above, re-throw it
                if (error.message && error.message.includes('429')) {
                    throw error;
                }

                // Network errors (fetch failed) logic could go here, but for now just log
                console.error(`❌ Kick API request failed: ${endpoint}`, error);
                throw error;
            }
        }

        throw new Error('Kick API request failed after retries');
    }

    /**
     * Check if the client is authenticated
     */
    isAuthenticated(): boolean {
        return kickAuthService.isAuthenticated();
    }

    // ========== User Endpoints ==========

    /**
     * Get the currently authenticated user
     */
    async getUser(): Promise<KickUser | null> {
        return UserEndpoints.getUser();
    }

    /**
     * Get users by IDs
     * https://docs.kick.com/apis/users - GET /public/v1/users?id[]=:id
     */
    async getUsersById(ids: number[]): Promise<KickApiUser[]> {
        return UserEndpoints.getUsersById(this, ids);
    }

    // ========== Channel Endpoints ==========

    /**
     * Get channel info by slug
     * https://docs.kick.com/apis/channels - GET /public/v1/channels?slug[]=:slug
     */
    async getChannel(slug: string): Promise<UnifiedChannel | null> {
        return ChannelEndpoints.getChannel(this, slug);
    }

    /**
     * Get multiple channels by their slugs
     * https://docs.kick.com/apis/channels - GET /public/v1/channels?slug[]=:slug&slug[]=:slug2
     */
    async getChannelsBySlugs(slugs: string[]): Promise<UnifiedChannel[]> {
        return ChannelEndpoints.getChannelsBySlugs(this, slugs);
    }

    /**
     * Get channel info using the public/legacy API (No Auth Required)
     * GET https://kick.com/api/v1/channels/:slug
     */
    async getPublicChannel(slug: string): Promise<UnifiedChannel | null> {
        return ChannelEndpoints.getPublicChannel(slug);
    }

    /**
     * Search for channels (using categories search + livestreams)
     * Note: Official API doesn't have a direct channel search endpoint
     */
    async searchChannels(
        query: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedChannel>> {
        return SearchEndpoints.searchChannels(this, query, options);
    }

    // ========== Stream Endpoints ==========

    /**
     * Get livestream by channel slug
     */
    async getStreamBySlug(slug: string): Promise<UnifiedStream | null> {
        return StreamEndpoints.getStreamBySlug(this, slug);
    }

    /**
     * Get stream info using the public/legacy API (No Auth Required)
     */
    async getPublicStreamBySlug(slug: string): Promise<UnifiedStream | null> {
        return StreamEndpoints.getPublicStreamBySlug(slug);
    }

    /**
     * Get top/featured live streams
     * https://docs.kick.com/apis/livestreams - GET /public/v1/livestreams
     */
    async getTopStreams(
        options: PaginationOptions & { categoryId?: string; language?: string } = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        return StreamEndpoints.getTopStreams(this, options);
    }

    /**
     * Get top streams using the legacy public API
     */
    async getPublicTopStreams(
        options: PaginationOptions & { categoryId?: string; language?: string } = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        return StreamEndpoints.getPublicTopStreams(options);
    }

    /**
     * Get streams by category
     * https://docs.kick.com/apis/livestreams - GET /public/v1/livestreams?category_id=:id
     */
    async getStreamsByCategory(
        categoryId: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        return StreamEndpoints.getStreamsByCategory(this, categoryId, options);
    }

    /**
     * Get followed streams (live channels the user follows)
     * Note: Official API doesn't have a direct followed streams endpoint
     */
    async getFollowedStreams(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedStream>> {
        return StreamEndpoints.getFollowedStreams(this, options);
    }

    // ========== Category Endpoints ==========

    /**
     * Get top/popular categories (derived from top streams)
     * Note: Kick official API doesn't have a "browse all" endpoint, so we aggregate from streams
     */
    async getTopCategories(
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedCategory>> {
        return CategoryEndpoints.getTopCategories(this, options);
    }

    /**
     * Search for categories
     * https://docs.kick.com/apis/categories - GET /public/v1/categories?q=:query
     */
    async searchCategories(
        query: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedCategory>> {
        return CategoryEndpoints.searchCategories(this, query, options);
    }

    /**
     * Get category by ID
     * https://docs.kick.com/apis/categories - GET /public/v1/categories/:category_id
     */
    async getCategoryById(id: string): Promise<UnifiedCategory | null> {
        return CategoryEndpoints.getCategoryById(this, id);
    }

    // ========== Follows Endpoints ==========
    // Note: The official Kick API does not currently have endpoints for follows

    /**
     * Get followed channels
     * Note: Not available in official API
     */
    async getFollowedChannels(
        _options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedChannel>> {
        console.warn('⚠️ Kick official API does not support followed channels endpoint');
        return { data: [] };
    }

    /**
     * Get all followed channels
     * Note: Not available in official API
     */
    async getAllFollowedChannels(): Promise<UnifiedChannel[]> {
        return [];
    }

    // ========== Search ==========

    /**
     * Full search across channels, categories, channels, streams, videos, and clips
     */
    async search(query: string): Promise<{ channels: any[]; categories: any[]; streams: any[]; videos: any[]; clips: any[] }> {
        return SearchEndpoints.search(this, query);
    }

    // ========== Videos ==========

    /**
     * Get videos by channel slug
     */
    async getVideos(
        slug: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<any>> {
        return VideoEndpoints.getVideosByChannelSlug(slug, options);
    }

    // ========== Clips ==========
    // Note: Clips endpoint not documented in official API

    /**
     * Get clips for a channel
     */
    async getClips(
        slug: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<any>> {
        return ClipEndpoints.getClipsByChannelSlug(slug, options);
    }
}

export const kickClient = new KickClient();
