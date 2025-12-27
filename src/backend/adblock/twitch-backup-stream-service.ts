/**
 * Twitch Backup Stream Service (VAFT Implementation)
 *
 * This service implements the core VAFT ad-blocking mechanism:
 * When ads are detected in the main stream, it finds an ad-free backup stream
 * by trying different playerType/platform combinations.
 *
 * Phase 1: Resolution matching for quality maintenance
 * Phase 2: Per-playerType caching and minimal requests mode
 *
 * Based on TwitchAdSolutions VAFT lines 511-588
 */

import {
    VAFT_BACKUP_PLAYER_TYPES,
    VAFT_AD_SIGNIFIER,
    generateRandomDeviceId,
    hasStitchedAds,
    TWITCH_CLIENT_ID,
    FALLBACK_DEVICE_ID,
    type TargetResolution,
} from '@/shared/adblock-types';

import {
    getStreamUrlForResolution,
    parseResolutionString,
} from './hls-playlist-parser';

// ========== Phase 2: Caching Types ==========

/**
 * Cache entry for a backup stream.
 * Based on VAFT BackupEncodingsM3U8Cache (lines 528-544)
 */
interface BackupCacheEntry {
    /** The master M3U8 content */
    encodingsM3u8: string;
    /** Access token value */
    tokenValue: string;
    /** Access token signature */
    tokenSignature: string;
    /** Stream URL */
    streamUrl: string;
    /** When this entry was fetched */
    fetchedAt: number;
    /** Whether this entry has ads (failed ad check) */
    hasAds: boolean;
}

// ========== Phase 2: Minimal Requests Constants ==========

/**
 * Duration after player reload to use minimal requests mode.
 * Based on VAFT PlayerReloadMinimalRequestsTime (line 516)
 */
const MINIMAL_REQUESTS_DURATION_MS = 1500; // 1.5 seconds

/**
 * Which player type index to use during minimal requests mode.
 * Based on VAFT PlayerReloadMinimalRequestsPlayerIndex (line 517)
 */
const MINIMAL_REQUESTS_PLAYER_INDEX = 0; // 'embed'

// ========== Interfaces ==========

export interface BackupStreamResult {
    /** The ad-free stream URL (master playlist) */
    url: string;
    /** The resolution-matched variant URL (if resolution matching succeeded) */
    variantUrl?: string;
    /** Which playerType worked */
    playerType: string;
    /** Which platform was used */
    platform: string;
    /** The access token value */
    tokenValue: string;
    /** The access token signature */
    tokenSignature: string;
    /** The master M3U8 content (for resolution switching) */
    masterM3u8?: string;
    /** Whether this result came from cache */
    fromCache?: boolean;
}

export interface BackupStreamOptions {
    /** Channel login name */
    channelLogin: string;
    /** Current stream resolution to match (e.g., '1080p60') */
    preferredResolution?: string;
    /** Target resolution for variant selection (parsed from preferredResolution or explicit) */
    targetResolution?: TargetResolution;
    /** Skip these playerTypes (already tried) */
    skipPlayerTypes?: string[];
    /** Timeout for each attempt in ms */
    timeoutMs?: number;
    /** Last player reload timestamp (for minimal requests mode) */
    lastPlayerReload?: number;
    /** Force skip cache (always fetch fresh) */
    skipCache?: boolean;
}

/**
 * Service for finding ad-free backup streams during playback.
 * Includes per-playerType caching and minimal requests mode.
 */
export class TwitchBackupStreamService {
    private readonly gqlEndpoint = 'https://gql.twitch.tv/gql';

    // ========== Phase 2: Caching ==========

    /**
     * Cache per channel per playerType.
     * Structure: Map<channelLogin, Map<playerType, BackupCacheEntry>>
     * Based on VAFT streamInfo.BackupEncodingsM3U8Cache (lines 528-544)
     */
    private backupCache: Map<string, Map<string, BackupCacheEntry>> = new Map();

    /**
     * Cache TTL in milliseconds (1 minute).
     */
    private readonly CACHE_TTL_MS = 60000;

    /**
     * Get a cached backup entry if valid.
     */
    private getCachedBackup(channelLogin: string, playerType: string): BackupCacheEntry | null {
        const channelCache = this.backupCache.get(channelLogin);
        if (!channelCache) return null;

        const entry = channelCache.get(playerType);
        if (!entry) return null;

        // Check if still valid
        if (Date.now() - entry.fetchedAt > this.CACHE_TTL_MS) {
            channelCache.delete(playerType);
            console.log(`[BackupStream] Cache expired for ${channelLogin}/${playerType}`);
            return null;
        }

        return entry;
    }

    /**
     * Set a cached backup entry.
     */
    private setCachedBackup(
        channelLogin: string,
        playerType: string,
        entry: Omit<BackupCacheEntry, 'fetchedAt'>
    ): void {
        if (!this.backupCache.has(channelLogin)) {
            this.backupCache.set(channelLogin, new Map());
        }
        this.backupCache.get(channelLogin)!.set(playerType, {
            ...entry,
            fetchedAt: Date.now()
        });
        console.log(`[BackupStream] Cached backup for ${channelLogin}/${playerType}`);
    }

    /**
     * Clear cache for a specific channel or all channels.
     * Should be called when stream changes.
     */
    clearCache(channelLogin?: string): void {
        if (channelLogin) {
            this.backupCache.delete(channelLogin);
            console.log(`[BackupStream] Cleared cache for ${channelLogin}`);
        } else {
            this.backupCache.clear();
            console.log('[BackupStream] Cleared all cache');
        }
    }

    /**
     * Get cache stats for debugging.
     */
    getCacheStats(): { channels: number; entriesPerChannel: Map<string, number> } {
        const entriesPerChannel = new Map<string, number>();
        for (const [channel, cache] of this.backupCache.entries()) {
            entriesPerChannel.set(channel, cache.size);
        }
        return {
            channels: this.backupCache.size,
            entriesPerChannel,
        };
    }

    // ========== Phase 2: Minimal Requests ==========

    /**
     * Check if minimal requests mode should be used.
     * Based on VAFT isDoingMinimalRequests (lines 516-520)
     */
    private shouldUseMinimalRequests(lastPlayerReload?: number): boolean {
        if (!lastPlayerReload) return false;
        return Date.now() - lastPlayerReload < MINIMAL_REQUESTS_DURATION_MS;
    }

    // ========== Main Methods ==========

    /**
     * Find an ad-free backup stream by trying different playerType/platform combinations.
     * Now includes:
     * - Resolution matching to maintain video quality
     * - Per-playerType caching to reduce API calls
     * - Minimal requests mode after player reload
     *
     * @returns BackupStreamResult if found, null if all options have ads
     */
    async findAdFreeStream(options: BackupStreamOptions): Promise<BackupStreamResult | null> {
        const {
            channelLogin,
            skipPlayerTypes = [],
            timeoutMs = 5000,
            preferredResolution,
            targetResolution: providedTargetResolution,
            lastPlayerReload,
            skipCache = false,
        } = options;

        console.log(`[BackupStream] Searching for ad-free stream for ${channelLogin}`);

        // Parse target resolution from preferredResolution string or use provided object
        let targetResolution = providedTargetResolution;
        if (!targetResolution && preferredResolution) {
            targetResolution = parseResolutionString(preferredResolution) ?? undefined;
            if (targetResolution) {
                console.log(`[BackupStream] Parsed target resolution: ${targetResolution.width}x${targetResolution.height}@${targetResolution.frameRate ?? 30}fps`);
            }
        }

        // Determine which strategies to try
        let strategies = [...VAFT_BACKUP_PLAYER_TYPES];
        const isMinimalRequestsMode = this.shouldUseMinimalRequests(lastPlayerReload);

        if (isMinimalRequestsMode) {
            console.log('[BackupStream] Using minimal requests mode (post-reload)');
            strategies = [VAFT_BACKUP_PLAYER_TYPES[MINIMAL_REQUESTS_PLAYER_INDEX]];
        }

        for (const strategy of strategies) {
            // Skip already-tried playerTypes
            if (skipPlayerTypes.includes(strategy.playerType)) {
                console.log(`[BackupStream] Skipping ${strategy.playerType} (already tried)`);
                continue;
            }

            try {
                // Check cache first (unless skipCache is true)
                if (!skipCache) {
                    const cached = this.getCachedBackup(channelLogin, strategy.playerType);
                    if (cached && !cached.hasAds) {
                        console.log(`[BackupStream] Using cached ad-free backup: ${strategy.playerType}`);

                        // Find resolution-matched variant URL from cached M3U8
                        let variantUrl: string | undefined;
                        if (targetResolution) {
                            const matched = getStreamUrlForResolution(cached.encodingsM3u8, targetResolution);
                            if (matched) {
                                variantUrl = matched;
                            }
                        }

                        return {
                            url: cached.streamUrl,
                            variantUrl,
                            playerType: strategy.playerType,
                            platform: strategy.platform,
                            tokenValue: cached.tokenValue,
                            tokenSignature: cached.tokenSignature,
                            masterM3u8: cached.encodingsM3u8,
                            fromCache: true,
                        };
                    } else if (cached && cached.hasAds) {
                        // Skip this playerType - we know it has ads
                        console.log(`[BackupStream] Skipping ${strategy.playerType} (cached with ads)`);
                        continue;
                    }
                }

                console.log(`[BackupStream] Trying ${strategy.playerType}/${strategy.platform}...`);

                // Get access token with this strategy
                const token = await this.getPlaybackAccessToken(
                    channelLogin,
                    strategy.playerType,
                    strategy.platform,
                    timeoutMs
                );

                if (!token) {
                    console.log(`[BackupStream] Failed to get token for ${strategy.playerType}`);
                    continue;
                }

                // Build the stream URL
                const streamUrl = this.constructStreamUrl(channelLogin, token.value, token.signature);

                // Fetch the master playlist and check for ads
                const m3u8Text = await this.fetchM3U8(streamUrl, timeoutMs);

                if (!m3u8Text) {
                    console.log(`[BackupStream] Failed to fetch M3U8 for ${strategy.playerType}`);
                    continue;
                }

                // Check if this stream has ads
                const streamHasAds = hasStitchedAds(m3u8Text);

                // Cache the result (whether it has ads or not)
                this.setCachedBackup(channelLogin, strategy.playerType, {
                    encodingsM3u8: m3u8Text,
                    tokenValue: token.value,
                    tokenSignature: token.signature,
                    streamUrl,
                    hasAds: streamHasAds,
                });

                if (!streamHasAds) {
                    console.log(`[BackupStream] Found ad-free stream: ${strategy.playerType}/${strategy.platform}`);

                    // Try to find resolution-matched variant URL
                    let variantUrl: string | undefined;
                    if (targetResolution) {
                        const matched = getStreamUrlForResolution(m3u8Text, targetResolution);
                        if (matched) {
                            variantUrl = matched;
                            console.log(`[BackupStream] Resolution-matched variant URL found`);
                        } else {
                            console.warn(`[BackupStream] Could not match resolution, will use master playlist`);
                        }
                    }

                    return {
                        url: streamUrl,
                        variantUrl,
                        playerType: strategy.playerType,
                        platform: strategy.platform,
                        tokenValue: token.value,
                        tokenSignature: token.signature,
                        masterM3u8: m3u8Text,
                        fromCache: false,
                    };
                } else {
                    console.log(`[BackupStream] ${strategy.playerType} has ads, trying next...`);
                }
            } catch (error) {
                console.warn(`[BackupStream] Error with ${strategy.playerType}:`, error);
                continue;
            }
        }

        console.log('[BackupStream] All strategies have ads, no ad-free backup found');
        return null;
    }

    /**
     * Get a playback access token using GQL.
     */
    private async getPlaybackAccessToken(
        channelLogin: string,
        playerType: string,
        platform: string,
        timeoutMs: number
    ): Promise<{ value: string; signature: string } | null> {
        const deviceId = generateRandomDeviceId();

        const query = {
            operationName: 'PlaybackAccessToken_Template',
            query: `query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!, $platform: String!) {
                streamPlaybackAccessToken(channelName: $login, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {
                    value
                    signature
                    __typename
                }
                videoPlaybackAccessToken(id: $vodID, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {
                    value
                    signature
                    __typename
                }
            }`,
            variables: {
                isLive: true,
                login: channelLogin,
                isVod: false,
                vodID: '',
                playerType,
                platform,
            },
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(this.gqlEndpoint, {
                method: 'POST',
                headers: {
                    'Client-Id': TWITCH_CLIENT_ID,
                    'Content-Type': 'application/json',
                    'X-Device-Id': deviceId,
                },
                body: JSON.stringify(query),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`[BackupStream] GQL request failed: ${response.status}`);
                return null;
            }

            const data = await response.json();
            const tokenData = data?.data?.streamPlaybackAccessToken;

            if (!tokenData?.value || !tokenData?.signature) {
                return null;
            }

            return {
                value: tokenData.value,
                signature: tokenData.signature,
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if ((error as Error).name === 'AbortError') {
                console.warn('[BackupStream] Token request timed out');
            }
            return null;
        }
    }

    /**
     * Construct the HLS stream URL.
     */
    private constructStreamUrl(channelLogin: string, tokenValue: string, tokenSignature: string): string {
        const params = new URLSearchParams({
            token: tokenValue,
            sig: tokenSignature,
            allow_source: 'true',
            allow_audio_only: 'true',
            fast_bread: 'true',
            p: Math.floor(Math.random() * 9999999).toString(),
            player_backend: 'mediaplayer',
            playlist_include_framerate: 'true',
            reassignments_supported: 'true',
            supported_codecs: 'avc1',
            cdm: 'wv',
            player_version: '1.22.0',
        });

        return `https://usher.ttvnw.net/api/channel/hls/${channelLogin}.m3u8?${params.toString()}`;
    }

    /**
     * Fetch and return M3U8 content.
     */
    private async fetchM3U8(url: string, timeoutMs: number): Promise<string | null> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                return null;
            }

            return await response.text();
        } catch (error) {
            clearTimeout(timeoutId);
            return null;
        }
    }

    /**
     * Check if a specific M3U8 URL contains ads.
     * Useful for checking variant playlists.
     */
    async checkStreamForAds(streamUrl: string, timeoutMs: number = 3000): Promise<boolean> {
        const m3u8Text = await this.fetchM3U8(streamUrl, timeoutMs);
        if (!m3u8Text) {
            return true; // Assume ads if we can't fetch
        }
        return hasStitchedAds(m3u8Text);
    }
}

// Singleton instance
let backupStreamService: TwitchBackupStreamService | null = null;

export function getBackupStreamService(): TwitchBackupStreamService {
    if (!backupStreamService) {
        backupStreamService = new TwitchBackupStreamService();
    }
    return backupStreamService;
}

