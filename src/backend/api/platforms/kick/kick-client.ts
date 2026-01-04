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
    /**
     * Make an HTTP request using Electron's net module
     * Uses Chromium's networking stack which handles IPv6-only domains (like api.kick.com) properly
     */
    /**
     * Make an HTTP request using Electron's net module
     * Uses Chromium's networking stack which handles IPv6-only domains (like api.kick.com) properly
     */
    private electronRequest<T>(
        url: string,
        method: string,
        headers: Record<string, string>,
        body?: string
    ): Promise<{ data: T; statusCode: number; responseHeaders: Record<string, string> }> {
        return new Promise((resolve, reject) => {
            const { net } = require('electron');

            const request = net.request({
                method,
                url,
            });

            // Set headers
            for (const [key, value] of Object.entries(headers)) {
                request.setHeader(key, value);
            }

            // Track completion
            let completed = false;

            // Timeout after 30 seconds
            const timeout = setTimeout(() => {
                if (completed) return;
                completed = true;
                request.abort();
                reject(new Error('Request timeout after 30s'));
            }, 30000);

            request.on('response', (response: any) => {
                let responseBody = '';
                const responseHeaders: Record<string, string> = {};

                // Collect response headers
                if (response.headers) {
                    for (const [key, value] of Object.entries(response.headers)) {
                        responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value[0] : value as string;
                    }
                }

                response.on('data', (chunk: Buffer) => {
                    responseBody += chunk.toString();
                });

                response.on('end', () => {
                    if (completed) return;
                    completed = true;
                    clearTimeout(timeout);
                    try {
                        const data = responseBody ? JSON.parse(responseBody) : null;
                        resolve({
                            data: data as T,
                            statusCode: response.statusCode,
                            responseHeaders
                        });
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON response: ${responseBody.substring(0, 200)}`));
                    }
                });

                response.on('error', (error: Error) => {
                    if (completed) return;
                    completed = true;
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            request.on('error', (error: Error) => {
                if (completed) return;
                completed = true;
                clearTimeout(timeout);
                reject(error);
            });

            // Send body if present
            if (body) {
                const contentLength = Buffer.byteLength(body, 'utf8');
                request.setHeader('Content-Length', contentLength.toString());
                request.write(body);
            }

            request.end();
        });
    }

    /**
     * Make a binary HTTP request using Electron's net module (for images)
     */
    private electronRequestBinary(
        url: string,
        headers: Record<string, string>
    ): Promise<{ buffer: Buffer; statusCode: number; contentType: string }> {
        return new Promise((resolve, reject) => {
            const { net } = require('electron');

            const request = net.request({
                method: 'GET',
                url,
            });

            for (const [key, value] of Object.entries(headers)) {
                request.setHeader(key, value);
            }

            let completed = false;

            // Timeout
            const timeout = setTimeout(() => {
                if (completed) return;
                completed = true;
                request.abort();
                reject(new Error('Request timeout'));
            }, 15000);

            request.on('response', (response: any) => {
                if (response.statusCode !== 200) {
                    if (completed) return;
                    completed = true;
                    clearTimeout(timeout);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const chunks: Buffer[] = [];
                const contentType = (response.headers['content-type'] && response.headers['content-type'][0])
                    || 'image/jpeg';

                response.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                response.on('end', () => {
                    if (completed) return;
                    completed = true;
                    clearTimeout(timeout);
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        buffer,
                        statusCode: response.statusCode,
                        contentType
                    });
                });

                response.on('error', (error: Error) => {
                    if (completed) return;
                    completed = true;
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            request.on('error', (error: Error) => {
                if (completed) return;
                completed = true;
                clearTimeout(timeout);
                reject(error);
            });

            request.end();
        });
    }

    /**
     * Fetch an image provided a URL and return it as a base64 data URL
     * Uses the same network stack and headers as other Kick requests
     */
    async fetchImage(url: string): Promise<string | null> {
        try {
            // 1. Setup headers exactly like the API request but with image acceptance
            const headers: Record<string, string> = {
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            };

            // Add Auth token if we have one (user or app)
            // This might be what's needed for 403s on some assets
            let token = kickAuthService.getAccessToken(); // Try user token first

            if (!token) {
                token = kickAuthService.getAppAccessToken();
            }

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Important: Referer/Origin for Hotlinking protection
            headers['Referer'] = 'https://kick.com/';
            headers['Origin'] = 'https://kick.com';

            const { buffer, contentType } = await this.electronRequestBinary(url, headers);

            const base64 = buffer.toString('base64');
            return `data:${contentType};base64,${base64}`;

        } catch (error) {
            console.warn(`[KickClient] Failed to fetch image ${url}:`, error);
            return null;
        }
    }

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
                const method = (options.method || 'GET').toUpperCase();
                const body = options.body ? String(options.body) : undefined;

                // Use Electron's net module for proper IPv6-only domain handling
                const response = await this.electronRequest<T>(url, method, headers, body);

                if (response.statusCode !== 200) {
                    // Handle rate limiting (429) with retry
                    if (response.statusCode === 429) {
                        attempt++;
                        if (attempt > maxRetries) {
                            throw new Error(`Kick API error: 429 (Max retries exceeded)`);
                        }

                        // Calculate backoff: 1s, 2s, 4s...
                        // Use Retry-After header if available
                        const retryHeader = response.responseHeaders['retry-after'];
                        const backoff = retryHeader
                            ? parseInt(retryHeader, 10) * 1000
                            : 1000 * Math.pow(2, attempt - 1);

                        console.warn(`⚠️ Kick API 429 Too Many Requests. Retrying in ${backoff}ms (Attempt ${attempt}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        continue;
                    }

                    // Handle transient server errors (502, 503, 504) with retry
                    if (response.statusCode === 502 || response.statusCode === 503 || response.statusCode === 504) {
                        attempt++;
                        if (attempt > maxRetries) {
                            throw new Error(`Kick API error: ${response.statusCode} (Max retries exceeded)`);
                        }

                        const backoff = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
                        console.warn(`⚠️ Kick API ${response.statusCode} Server Error. Retrying in ${backoff}ms (Attempt ${attempt}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        continue;
                    }

                    if (response.statusCode === 403) {
                        console.warn('⚠️ Kick API forbidden - may need additional scopes or User Token');
                    }

                    if (response.statusCode === 401) {
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

                    throw new Error(`Kick API error: ${response.statusCode}`);
                }

                return response.data;
            } catch (error: any) {
                // If it's a 429 error we deliberately threw above, re-throw it
                if (error.message && error.message.includes('429')) {
                    throw error;
                }

                // Network errors - log and throw
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
