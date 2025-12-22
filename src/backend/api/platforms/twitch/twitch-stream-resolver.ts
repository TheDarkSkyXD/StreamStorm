import {
    TwitchGqlResponse,
    TwitchPlaybackAccessTokenData,
    StreamPlayback
} from './twitch-types';
import { StreamProxyConfig } from '../../../../shared/proxy-types';
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

    private constructHlsUrl(channel: string, token: string, sig: string): string {
        // Construct the usher URL
        // Random integer 0-999999 for cache busting
        const p = Math.floor(Math.random() * 999999);
        return `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?token=${encodeURIComponent(token)}&sig=${sig}&allow_source=true&allow_audio_only=true&p=${p}`;
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
