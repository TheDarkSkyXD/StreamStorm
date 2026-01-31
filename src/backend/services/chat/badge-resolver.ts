/**
 * Twitch Badge Resolver
 *
 * Resolves badge identifiers to full badge data including images.
 * Fetches and caches global and channel badges from Twitch API.
 */

import type { ChatBadge, BadgeSet, BadgeVersion } from '../../../shared/chat-types';
import { getOAuthConfig } from '../../auth/oauth-config';
import { storageService } from '../storage-service';

// ========== Types ==========

interface TwitchBadgeVersion {
    id: string;
    image_url_1x: string;
    image_url_2x: string;
    image_url_4x: string;
    title: string;
    description: string;
    click_action: string | null;
    click_url: string | null;
}

interface TwitchBadgeSet {
    set_id: string;
    versions: TwitchBadgeVersion[];
}

interface TwitchBadgesResponse {
    data: TwitchBadgeSet[];
}

// ========== Constants ==========

const TWITCH_API_BASE = 'https://api.twitch.tv/helix';
const BADGE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ========== BadgeResolver Class ==========

export class BadgeResolver {
    /** Global badges (available in all channels) */
    private globalBadges: Map<string, BadgeSet> = new Map();

    /** Channel-specific badges (keyed by broadcaster ID) */
    private channelBadges: Map<string, Map<string, BadgeSet>> = new Map();

    /** Timestamps for cache invalidation */
    private globalBadgesLoadedAt: number = 0;
    private channelBadgesLoadedAt: Map<string, number> = new Map();

    // ========== Loading Methods ==========

    /**
     * Load global Twitch badges
     */
    async loadGlobalBadges(): Promise<void> {
        // Check cache validity
        if (
            this.globalBadges.size > 0 &&
            Date.now() - this.globalBadgesLoadedAt < BADGE_CACHE_TTL
        ) {
            return;
        }

        try {
            const badges = await this.fetchBadges('/chat/badges/global');
            this.globalBadges = this.transformBadges(badges);
            this.globalBadgesLoadedAt = Date.now();
            console.debug(`✅ Loaded ${this.globalBadges.size} global badge sets`);
        } catch (error) {
            console.error('❌ Failed to load global badges:', error);
        }
    }

    /**
     * Load channel-specific badges
     */
    async loadChannelBadges(broadcasterId: string): Promise<void> {
        // Check cache validity
        const loadedAt = this.channelBadgesLoadedAt.get(broadcasterId);
        if (
            this.channelBadges.has(broadcasterId) &&
            loadedAt &&
            Date.now() - loadedAt < BADGE_CACHE_TTL
        ) {
            return;
        }

        try {
            const badges = await this.fetchBadges(
                `/chat/badges?broadcaster_id=${broadcasterId}`
            );
            this.channelBadges.set(broadcasterId, this.transformBadges(badges));
            this.channelBadgesLoadedAt.set(broadcasterId, Date.now());
            console.debug(
                `✅ Loaded ${this.channelBadges.get(broadcasterId)?.size ?? 0} badge sets for channel ${broadcasterId}`
            );
        } catch (error) {
            console.error(`❌ Failed to load badges for channel ${broadcasterId}:`, error);
        }
    }

    // ========== Resolution Methods ==========

    /**
     * Resolve a list of badge identifiers to full badge data
     */
    resolveBadges(badges: ChatBadge[], broadcasterId?: string): ChatBadge[] {
        return badges.map((badge) => this.resolveBadge(badge, broadcasterId));
    }

    /**
     * Resolve a single badge identifier to full badge data
     */
    resolveBadge(badge: ChatBadge, broadcasterId?: string): ChatBadge {
        // Try channel badges first (they override global)
        if (broadcasterId) {
            const channelSet = this.channelBadges.get(broadcasterId)?.get(badge.setId);
            if (channelSet) {
                const version = channelSet.versions.get(badge.version);
                if (version) {
                    return {
                        setId: badge.setId,
                        version: badge.version,
                        imageUrl: version.imageUrl4x,
                        title: version.title,
                    };
                }
            }
        }

        // Fall back to global badges
        const globalSet = this.globalBadges.get(badge.setId);
        if (globalSet) {
            const version = globalSet.versions.get(badge.version);
            if (version) {
                return {
                    setId: badge.setId,
                    version: badge.version,
                    imageUrl: version.imageUrl4x,
                    title: version.title,
                };
            }
        }

        // Return original if not found (with empty URL)
        return badge;
    }

    /**
     * Check if a user has a specific badge
     */
    hasBadge(badges: ChatBadge[], setId: string): boolean {
        return badges.some((badge) => badge.setId === setId);
    }

    /**
     * Check if a user is a moderator based on badges
     */
    isModerator(badges: ChatBadge[]): boolean {
        return this.hasBadge(badges, 'moderator') || this.hasBadge(badges, 'broadcaster');
    }

    /**
     * Check if a user is a VIP based on badges
     */
    isVIP(badges: ChatBadge[]): boolean {
        return this.hasBadge(badges, 'vip');
    }

    /**
     * Check if a user is a subscriber based on badges
     */
    isSubscriber(badges: ChatBadge[]): boolean {
        return this.hasBadge(badges, 'subscriber') || this.hasBadge(badges, 'founder');
    }

    // ========== Private Methods ==========

    /**
     * Fetch badges from Twitch API
     */
    private async fetchBadges(endpoint: string): Promise<TwitchBadgeSet[]> {
        const config = getOAuthConfig('twitch');

        // Try user token first, fall back to app token
        let token = storageService.getToken('twitch')?.accessToken;
        if (!token) {
            const appToken = storageService.getAppToken('twitch');
            token = typeof appToken === 'string' ? appToken : appToken?.accessToken;
        }

        if (!token) {
            throw new Error('No Twitch token available for badge fetch');
        }

        const response = await fetch(`${TWITCH_API_BASE}${endpoint}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Client-Id': config.clientId,
            },
        });

        if (!response.ok) {
            throw new Error(`Badge API error: ${response.status}`);
        }

        const data = (await response.json()) as TwitchBadgesResponse;
        return data.data;
    }

    /**
     * Transform API response to our BadgeSet format
     */
    private transformBadges(apiBadges: TwitchBadgeSet[]): Map<string, BadgeSet> {
        const result = new Map<string, BadgeSet>();

        for (const apiSet of apiBadges) {
            const versions = new Map<string, BadgeVersion>();

            for (const apiVersion of apiSet.versions) {
                versions.set(apiVersion.id, {
                    id: apiVersion.id,
                    imageUrl1x: apiVersion.image_url_1x,
                    imageUrl2x: apiVersion.image_url_2x,
                    imageUrl4x: apiVersion.image_url_4x,
                    title: apiVersion.title,
                    description: apiVersion.description,
                });
            }

            result.set(apiSet.set_id, {
                setId: apiSet.set_id,
                versions,
            });
        }

        return result;
    }

    /**
     * Clear all cached badges
     */
    clearCache(): void {
        this.globalBadges.clear();
        this.channelBadges.clear();
        this.globalBadgesLoadedAt = 0;
        this.channelBadgesLoadedAt.clear();
    }
}

// ========== Export Singleton ==========

export const badgeResolver = new BadgeResolver();
