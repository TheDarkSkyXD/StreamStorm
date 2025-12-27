import {
    TwitchGqlResponse,
    TwitchPlaybackAccessTokenData,
    StreamPlayback
} from './twitch-types';
import { StreamProxyConfig } from '../../../../shared/proxy-types';
import { TwitchAdBlockConfig, generateRandomDeviceId, FALLBACK_DEVICE_ID } from '../../../../shared/adblock-types';
import { TwitchProxyService, ProxyConfigError } from './twitch-proxy-service';

export class TwitchStreamResolver {
    // Standard web client ID used for GQL playback requests
    // This is public information used by the Twitch web player
    private readonly GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    private readonly GQL_ENDPOINT = 'https://gql.twitch.tv/gql';

    /**
     * Get playback URL for a live stream
     * IMPORTANT: First checks if the channel is actually live to avoid 404 errors
     */
    async getStreamPlaybackUrl(channelLogin: string): Promise<StreamPlayback> {
        try {
            // First, check if the channel is actually live using the Twitch API
            // This prevents returning a URL for offline channels which would cause 404 errors
            const { twitchClient } = await import('./twitch-client');
            const stream = await twitchClient.getStreamByLogin(channelLogin);

            if (!stream) {
                throw new Error('Channel is offline');
            }

            const token = await this.getPlaybackAccessToken(channelLogin, false);
            const url = this.constructHlsUrl(channelLogin, token.value, token.signature);
            return {
                url,
                format: 'hls'
            };
        } catch (error) {
            // Don't log "offline" errors as they're expected behavior
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.toLowerCase().includes('offline')) {
                console.error('Failed to resolve Twitch stream URL for:', channelLogin, error);
            }
            throw error;
        }
    }

    /**
     * Get stream URL with optional proxy support.
     * If proxy is configured, routes through ad-blocking proxy.
     * Falls back to direct URL if proxy fails and fallbackToDirect is enabled.
     *
     * Error classification:
     * - ProxyConfigError with code 'invalid_custom_url' → user notification + fallback
     * - ProxyConfigError with code 'disabled' or 'not_configured' → fallback silently
     * - Network errors (TypeError from fetch) → fallback if enabled
     * - Other errors → may need explicit user notification
     *
     * @param channelLogin - The channel login/username
     * @param proxyConfig - Optional proxy configuration (if undefined, uses direct stream)
     * @returns StreamPlayback object with URL
     */
    async getStreamPlaybackUrlWithProxy(
        channelLogin: string,
        proxyConfig?: StreamProxyConfig
    ): Promise<StreamPlayback> {
        // If proxy is configured and enabled
        if (proxyConfig && proxyConfig.selectedProxy !== 'none') {
            try {
                const proxyService = new TwitchProxyService(proxyConfig);
                const result = proxyService.getProxiedStreamUrl(channelLogin);
                console.log(`[TwitchResolver] Using proxy: ${proxyConfig.selectedProxy}`);
                return result;
            } catch (proxyError) {
                // Use ProxyConfigError code for reliable error classification
                const isProxyConfigError = proxyError instanceof ProxyConfigError;
                const errorCode = isProxyConfigError ? proxyError.code : null;
                const isNetworkError = proxyError instanceof TypeError; // fetch network errors

                console.warn('[TwitchResolver] Proxy error:', {
                    type: errorCode || (isNetworkError ? 'network' : 'unknown'),
                    message: proxyError instanceof Error ? proxyError.message : String(proxyError),
                });

                // For invalid custom URL, log a user-facing warning before fallback
                if (errorCode === 'invalid_custom_url') {
                    console.error('[TwitchResolver] Custom proxy URL is invalid. Please update your settings.');
                    // TODO: Emit event for frontend toast notification
                }

                // Fallback to direct if configured
                if (proxyConfig.fallbackToDirect) {
                    console.log('[TwitchResolver] Falling back to direct stream');
                    return this.getStreamPlaybackUrl(channelLogin);
                }
                throw proxyError;
            }
        }

        // No proxy configured, use direct URL
        return this.getStreamPlaybackUrl(channelLogin);
    }

    /**
     * Get stream URL with ad-block support.
     * Implements mutual exclusivity: ad-block takes precedence over proxy.
     *
     * Priority:
     * 1. If adBlockConfig is enabled → use native ad-block (ignores proxy)
     * 2. If proxyConfig is enabled  → use proxy
     * 3. Otherwise                  → use direct stream
     *
     * @param channelLogin - The channel login/username
     * @param adBlockConfig - Optional ad-block configuration
     * @param proxyConfig - Optional proxy configuration (ignored if ad-block enabled)
     * @returns StreamPlayback object with URL
     */
    async getStreamPlaybackUrlWithAdBlock(
        channelLogin: string,
        adBlockConfig?: TwitchAdBlockConfig,
        proxyConfig?: StreamProxyConfig
    ): Promise<StreamPlayback> {
        // Ad-block takes precedence over proxy (mutual exclusivity)
        if (adBlockConfig?.enabled) {
            try {
                // First, check if the channel is actually live
                const { twitchClient } = await import('./twitch-client');
                const stream = await twitchClient.getStreamByLogin(channelLogin);

                if (!stream) {
                    throw new Error('Channel is offline');
                }

                // Get token with ad-block modifications
                const token = await this.getPlaybackAccessTokenWithAdBlock(
                    channelLogin,
                    false,
                    adBlockConfig
                );

                // Construct URL with fast_bread for lower latency
                const url = this.constructHlsUrl(
                    channelLogin,
                    token.value,
                    token.signature,
                    true // includeFastBread
                );

                console.log(`[TwitchResolver] Ad-block enabled: playerType=${adBlockConfig.playerType}, platform=${adBlockConfig.platform}`);

                return {
                    url,
                    format: 'hls'
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (!errorMessage.toLowerCase().includes('offline')) {
                    console.error('[TwitchResolver] Ad-block stream resolution failed:', error);
                }
                throw error;
            }
        }

        // Fall back to proxy or direct stream
        return this.getStreamPlaybackUrlWithProxy(channelLogin, proxyConfig);
    }

    /**
     * Get playback access token with ad-block modifications.
     * Adds X-Device-Id header and configurable playerType/platform.
     */
    private async getPlaybackAccessTokenWithAdBlock(
        loginOrId: string,
        isVod: boolean,
        config: TwitchAdBlockConfig
    ): Promise<{ value: string; signature: string }> {
        // Build headers with optional X-Device-Id
        const headers: Record<string, string> = {
            'Client-Id': this.GQL_CLIENT_ID,
            'Content-Type': 'application/json'
        };

        // Always send X-Device-Id when ad-block is enabled
        // This is key to bypassing ad tracking - either random (new user each time)
        // or fallback (consistent ID that avoids some ad targeting)
        if (config.useRandomDeviceId) {
            headers['X-Device-Id'] = generateRandomDeviceId();
            console.log('[TwitchResolver] Using random X-Device-Id for ad-block');
        } else {
            headers['X-Device-Id'] = config.fallbackDeviceId || FALLBACK_DEVICE_ID;
            console.log('[TwitchResolver] Using fallback X-Device-Id for ad-block');
        }

        // Query with configurable platform and playerType
        // Note: supportedCodecs is not accepted by Twitch's current GQL API
        const query = `
            query PlaybackAccessToken(
                $login: String!,
                $vodID: ID!,
                $isVod: Boolean!,
                $playerType: String!,
                $platform: String!
            ) {
                streamPlaybackAccessToken(
                    channelName: $login,
                    params: {
                        platform: $platform,
                        playerBackend: "mediaplayer",
                        playerType: $playerType
                    }
                ) @skip(if: $isVod) {
                    value
                    signature
                }
                videoPlaybackAccessToken(
                    id: $vodID,
                    params: {
                        platform: $platform,
                        playerBackend: "mediaplayer",
                        playerType: $playerType
                    }
                ) @include(if: $isVod) {
                    value
                    signature
                }
            }
        `;

        const variables = {
            login: isVod ? '' : loginOrId.toLowerCase(),
            isVod: isVod,
            vodID: isVod ? loginOrId : '',
            playerType: config.playerType,
            platform: config.platform
            // Note: supportedCodecs kept in config for future use if API changes
        };

        const response = await fetch(this.GQL_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            throw new Error(`GQL request failed: ${response.status}`);
        }

        const json = await response.json() as TwitchGqlResponse<TwitchPlaybackAccessTokenData>;

        if (json.errors) {
            throw new Error(`GQL Errors: ${JSON.stringify(json.errors)}`);
        }

        const data = json.data;
        if (isVod) {
            if (!data.videoPlaybackAccessToken) {
                throw new Error('No VOD token found. The VOD might be sub-only or deleted.');
            }
            return data.videoPlaybackAccessToken;
        } else {
            if (!data.streamPlaybackAccessToken) {
                throw new Error('No stream token found. The channel might be offline or non-existent.');
            }
            return data.streamPlaybackAccessToken;
        }
    }

    /**
     * Get playback URL for a VOD
     */
    async getVodPlaybackUrl(vodId: string): Promise<StreamPlayback> {
        try {
            const token = await this.getPlaybackAccessToken(vodId, true);
            const url = this.constructVodUrl(vodId, token.value, token.signature);
            return {
                url,
                format: 'hls'
            };
        } catch (error) {
            console.error('Failed to resolve Twitch VOD URL for:', vodId, error);
            throw error;
        }
    }

    /**
     * Get playback URL for a VOD with ad-block support.
     * Uses the same ad-block token modifications as live streams.
     *
     * @param vodId - The VOD ID
     * @param adBlockConfig - Optional ad-block configuration
     * @returns StreamPlayback object with URL
     */
    async getVodPlaybackUrlWithAdBlock(
        vodId: string,
        adBlockConfig?: TwitchAdBlockConfig
    ): Promise<StreamPlayback> {
        if (adBlockConfig?.enabled) {
            try {
                // Mark this as a VOD request for the token handler
                const vodConfig: TwitchAdBlockConfig = {
                    ...adBlockConfig,
                    isVod: true,
                };

                const token = await this.getPlaybackAccessTokenWithAdBlock(
                    vodId,
                    true,
                    vodConfig
                );

                const url = this.constructVodUrl(vodId, token.value, token.signature);

                console.log(`[TwitchResolver] VOD ad-block enabled: playerType=${adBlockConfig.playerType}`);

                return {
                    url,
                    format: 'hls'
                };
            } catch (error) {
                console.error('[TwitchResolver] VOD ad-block resolution failed:', error);
                throw error;
            }
        }

        // Fall back to regular VOD URL
        return this.getVodPlaybackUrl(vodId);
    }

    private async getPlaybackAccessToken(loginOrId: string, isVod: boolean): Promise<{ value: string, signature: string }> {
        // Query to fetch playback access token
        const query = `
            query PlaybackAccessToken(
                $login: String!,
                $vodID: ID!,
                $isVod: Boolean!,
                $playerType: String!
            ) {
                streamPlaybackAccessToken(
                    channelName: $login,
                    params: {
                        platform: "web",
                        playerBackend: "mediaplayer",
                        playerType: $playerType
                    }
                ) @skip(if: $isVod) {
                    value
                    signature
                }
                videoPlaybackAccessToken(
                    id: $vodID,
                    params: {
                        platform: "web",
                        playerBackend: "mediaplayer",
                        playerType: $playerType
                    }
                ) @include(if: $isVod) {
                    value
                    signature
                }
            }
        `;

        const variables = {
            login: isVod ? '' : loginOrId.toLowerCase(),
            isVod: isVod,
            vodID: isVod ? loginOrId : '',
            playerType: "site"
        };

        const response = await fetch(this.GQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Client-Id': this.GQL_CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query,
                variables
            })
        });

        if (!response.ok) {
            throw new Error(`GQL request failed: ${response.status}`);
        }

        const json = await response.json() as TwitchGqlResponse<TwitchPlaybackAccessTokenData>;

        if (json.errors) {
            throw new Error(`GQL Errors: ${JSON.stringify(json.errors)}`);
        }

        const data = json.data;
        if (isVod) {
            if (!data.videoPlaybackAccessToken) {
                throw new Error('No VOD token found. The VOD might be sub-only or deleted.');
            }
            return data.videoPlaybackAccessToken;
        } else {
            if (!data.streamPlaybackAccessToken) {
                throw new Error('No stream token found. The channel might be offline or non-existent.');
            }
            return data.streamPlaybackAccessToken;
        }
    }

    private constructHlsUrl(
        channel: string,
        token: string,
        sig: string,
        includeFastBread: boolean = false
    ): string {
        // Construct the usher URL
        // Random integer 0-999999 for cache busting
        const p = Math.floor(Math.random() * 999999);
        let url = `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?` +
            `token=${encodeURIComponent(token)}` +
            `&sig=${sig}` +
            `&allow_source=true` +
            `&allow_audio_only=true` +
            `&p=${p}`;

        // Add fast_bread for low latency when ad-block is enabled
        if (includeFastBread) {
            url += '&fast_bread=true';
        }

        return url;
    }

    private constructVodUrl(vodId: string, token: string, sig: string): string {
        // Construct the usher VOD URL
        const p = Math.floor(Math.random() * 999999);
        return `https://usher.ttvnw.net/vod/${vodId}.m3u8?token=${encodeURIComponent(token)}&sig=${sig}&allow_source=true&allow_audio_only=true&p=${p}`;
    }

    /**
     * Get playback URL for a clip using GQL API
     * This fetches the actual video qualities AND the playback access token from Twitch's GraphQL endpoint
     * The sourceURL needs the sig and token query parameters to work - otherwise Twitch returns 404
     */
    async getClipPlaybackUrl(clipSlug: string): Promise<StreamPlayback> {
        try {
            // Use the VideoAccessToken_Clip persisted query which returns both video qualities AND access token
            // Hash updated from streamlink project: https://github.com/streamlink/streamlink/blob/master/src/streamlink/plugins/twitch.py
            const query = {
                operationName: 'VideoAccessToken_Clip',
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: '993d9a5131f15a37bd16f32342c44ed1e0b1a9b968c6afdb662d2cddd595f6c5'
                    }
                },
                variables: {
                    slug: clipSlug,
                    platform: 'web'
                }
            };

            const response = await fetch(this.GQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Client-Id': this.GQL_CLIENT_ID,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(query)
            });

            if (!response.ok) {
                throw new Error(`GQL request failed: ${response.status}`);
            }

            const json = await response.json() as {
                data?: {
                    clip?: {
                        playbackAccessToken?: {
                            signature: string;
                            value: string;
                        };
                        videoQualities?: Array<{
                            sourceURL: string;
                            quality: string;
                            frameRate: number;
                        }>;
                    };
                };
                errors?: any[];
            };

            if (json.errors) {
                throw new Error(`GQL Errors: ${JSON.stringify(json.errors)}`);
            }

            const clip = json.data?.clip;
            if (!clip) {
                throw new Error('Clip not found');
            }

            const qualities = clip.videoQualities;
            const accessToken = clip.playbackAccessToken;

            if (!qualities || qualities.length === 0) {
                throw new Error('No video qualities found for this clip');
            }

            if (!accessToken) {
                throw new Error('No playback access token found for this clip');
            }

            // Get the highest quality - sort by quality (descending) and pick the first
            // Quality is usually like "1080", "720", "480", "360"
            const sortedQualities = [...qualities].sort((a, b) => {
                const qualityA = parseInt(a.quality) || 0;
                const qualityB = parseInt(b.quality) || 0;
                return qualityB - qualityA;
            });

            const bestQuality = sortedQualities[0];

            // Construct the final URL with authentication parameters
            const finalUrl = `${bestQuality.sourceURL}?sig=${accessToken.signature}&token=${encodeURIComponent(accessToken.value)}`;

            return {
                url: finalUrl,
                format: 'mp4'
            };
        } catch (error) {
            console.error('Failed to get clip playback URL:', clipSlug, error);
            throw error;
        }
    }
}
