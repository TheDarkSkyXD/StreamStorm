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

        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                if (response.status === 403) {
                    console.warn('⚠️ Kick API forbidden - may need additional scopes or User Token');
                }

                if (response.status === 401) {
                    console.log(`🔄 Kick ${isAppToken ? 'App' : 'User'} token expired, refreshing...`);
                    // Force refresh
                    if (isAppToken) {
                        // storageService.isAppTokenExpired will be checked next call, 
                        // but we might need to force clear/re-fetch here? 
                        // For now, let's rely on retry.
                        // Actually, handle retry logic:
                        // Simple retry not implemented safely without inf loop risk. 
                        // relying on ensureValidAppToken check next time.
                    } else {
                        const refreshed = await kickAuthService.refreshToken();
                        if (refreshed) {
                            return this.request<T>(endpoint, options);
                        }
                    }
                }

                throw new Error(`Kick API error: ${response.status}`);
            }

            return (await response.json()) as T;
        } catch (error) {
            console.error(`❌ Kick API request failed: ${endpoint}`, error);
            throw error;
        }
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

    // ========== Clips ==========
    // Note: Clips endpoint not documented in official API

    /**
     * Get clips for a channel
     * Note: Not available in official API
     */
    async getClips(_slug: string): Promise<UnifiedClip[]> {
        console.warn('⚠️ Kick official API does not support clips endpoint');
        return [];
    }
}

export const kickClient = new KickClient();
