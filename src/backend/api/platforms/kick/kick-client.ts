/**
 * Kick API Client
 *
 * Client for interacting with the Kick API.
 * Handles authentication and data fetching.
 */

import type { KickUser } from '../../../../shared/auth-types';
import { kickAuthService } from '../../../auth/kick-auth';
import { storageService } from '../../../services/storage-service';
import type { UnifiedStream, UnifiedChannel, UnifiedCategory, UnifiedVideo, UnifiedClip } from '../../unified/platform-types';
import {
    KICK_API_BASE,
    KICK_API_V1_BASE,
    type KickApiLivestream,
    type KickApiChannel,
    type KickApiCategory,
    type KickApiSearchResult,
    type KickApiVideo,
    type KickApiClip
} from './kick-types';
import {
    transformKickStream,
    transformKickChannel,
    transformKickCategory,
    transformKickVideo,
    transformKickClip
} from './kick-transformers';

// ========== Types ==========

export interface PaginationOptions {
    limit?: number;
    page?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    cursor?: string; // Kick doesn't really use cursors like Twitch, but maintaining interface
    nextPage?: number;
}

// ========== Kick API Client Class ==========

class KickClient {
    private readonly baseUrl = KICK_API_BASE;
    private readonly v1BaseUrl = KICK_API_V1_BASE;

    /**
     * Make an authenticated request to the Kick API
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        // Ensure we have a valid token
        await kickAuthService.ensureValidToken();

        const token = storageService.getToken('kick');
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers as Record<string, string>,
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token.accessToken}`;
        }

        // Kick API sometimes requires cookies or specific headers that are hard to replicate
        // without a browser. In a real Electron app, we might proxy requests through
        // the main process using values from the authenticated/cookies session.

        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                // Kick sometimes returns 403 Cloudflare challenges
                if (response.status === 403) {
                    console.warn('⚠️ Kick API Cloudflare challenge encountered');
                    // In a real implementation, we might need to solve this via a hidden window
                    // or by piggybacking on the user's session cookies.
                }

                if (response.status === 401) {
                    console.log('🔄 Kick token expired, refreshing...');
                    const refreshed = await kickAuthService.refreshToken();
                    if (refreshed) {
                        return this.request<T>(endpoint, options);
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

    // ========== User Endpoints ==========

    /**
     * Get the currently authenticated user
     */
    async getUser(): Promise<KickUser | null> {
        return kickAuthService.fetchCurrentUser();
    }

    // ========== Channel Endpoints ==========

    /**
     * Get channel info by slug
     */
    async getChannel(slug: string): Promise<UnifiedChannel | null> {
        try {
            const data = await this.request<{
                id: number;
                user_id: number;
                slug: string;
                user: { username: string; profile_pic: string; bio: string };
                livestream: KickApiLivestream | null;
                followers_count: number;
                verified: boolean;
            }>(`/channels/${slug}`);

            // Map the partial response to our transformer expected format
            // Note: The /channels/{slug} endpoint returns more details than this mock structure
            // We would map it accurately to KickApiChannel in a real full implementation

            // For now, we'll cast it with caution or fetch strictly typed
            // Ideally, we make sure the response matches KickApiChannel
            // But let's assume we get enough data to transform

            const fullChannel = data as unknown as KickApiChannel; // Force cast for now
            return transformKickChannel(fullChannel);
        } catch (error) {
            console.error('Failed to fetch Kick channel:', error);
            return null;
        }
    }

    /**
     * Get followed channels
     * Note: Kick's API for this is private/undocumented and changes often.
     * We'll attempt to use the generic one found in network traces: /users/{userid}/following/channels
     */
    async getFollowedChannels(
        userId: string, // Kick numerical User ID (not slug)
        options: PaginationOptions = {}
    ): Promise<PaginatedResult<UnifiedChannel>> {
        const page = options.page || 1;
        try {
            // This endpoint might be: /users/{id}/following?page={page}
            // data format: { data: [{ channel_id, ... }, ...] }
            // This is complex because we need the Channel object, not just ID.

            // Fallback: If we can't get it easily, return empty for now
            return { data: [] };
        } catch (error) {
            return { data: [] };
        }
    }

    // ========== Stream Endpoints ==========

    /**
     * Get livestream by channel slug
     */
    async getStreamBySlug(slug: string): Promise<UnifiedStream | null> {
        try {
            const channel = await this.request<KickApiChannel>(`/channels/${slug}`);

            if (channel.livestream && channel.livestream.is_live) {
                return transformKickStream(channel.livestream, channel);
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    // ========== Search ==========

    /**
     * Search channels/categories
     * Endpoint: /search?term={query}
     */
    async search(query: string): Promise<KickApiSearchResult> {
        try {
            // Note: Use V1 or V2 search endpoint
            // V2 usually structures results by type
            return await this.request<KickApiSearchResult>(`/search?term=${encodeURIComponent(query)}`);
        } catch (error) {
            return { channels: [], categories: [], videos: [] };
        }
    }

    // ========== Clips ==========

    /**
     * Get clips for a channel
     * Endpoint: /channels/{slug}/clips
     */
    async getClips(slug: string): Promise<UnifiedClip[]> {
        try {
            const data = await this.request<{ clips: KickApiClip[] }>(`/channels/${slug}/clips`);
            return data.clips.map(transformKickClip);
        } catch {
            return [];
        }
    }
}

export const kickClient = new KickClient();
