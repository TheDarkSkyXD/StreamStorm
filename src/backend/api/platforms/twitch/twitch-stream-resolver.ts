import {
    TwitchGqlResponse,
    TwitchPlaybackAccessTokenData,
    StreamPlayback
} from './twitch-types';

export class TwitchStreamResolver {
    // Standard web client ID used for GQL playback requests
    // This is public information used by the Twitch web player
    private readonly GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    private readonly GQL_ENDPOINT = 'https://gql.twitch.tv/gql';

    /**
     * Fetch with automatic retry for transient network errors.
     * Handles ECONNRESET, ETIMEDOUT, and other socket-level failures
     * that occur during TLS handshake with gql.twitch.tv.
     */
    private async fetchWithRetry(
        url: string,
        options: RequestInit,
        maxRetries: number = 3,
        baseDelay: number = 1000,
        timeout: number = 15000
    ): Promise<Response> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            // Move controller and timeoutId outside try block to ensure cleanup in finally
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                // Retry on transient server errors
                if (response.status >= 502 && response.status <= 504) {
                    if (attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(2, attempt);
                        console.warn(`⚠️ Twitch GQL server error ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    throw new Error(`GQL server error: ${response.status} after ${maxRetries + 1} attempts`);
                }

                return response;
            } catch (error) {
                lastError = error as Error;
                const isRetryable = this.isRetryableError(error);

                if (!isRetryable || attempt === maxRetries) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, attempt);
                const errorMsg = (error as Error).message || 'Unknown error';
                const errorCode = this.getErrorCode(error);
                console.warn(`⚠️ Twitch GQL request failed [${errorCode || 'NETWORK'}] (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms... Error: ${errorMsg}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } finally {
                // Always clear the timeout to prevent stray timers
                clearTimeout(timeoutId);
            }
        }

        throw lastError || new Error('Request failed after retries');
    }

    /**
     * Check if an error is retryable (transient network issues)
     */
    private isRetryableError(error: unknown): boolean {
        if (error instanceof Error) {
            const code = this.getErrorCode(error);

            // Network-level errors that are typically transient
            const retryableCodes = [
                'ECONNRESET',    // Connection reset (TLS handshake failure)
                'ETIMEDOUT',     // Connection timed out
                'ENOTFOUND',     // DNS lookup failed (transient)
                'ECONNREFUSED',  // Connection refused
                'ENETUNREACH',   // Network unreachable
                'EHOSTUNREACH',  // Host unreachable
                'EPIPE',         // Broken pipe
                'EAI_AGAIN'      // DNS temporary failure
            ];

            if (code && retryableCodes.includes(code)) {
                return true;
            }

            // AbortError means our timeout triggered - retry
            if (error.name === 'AbortError') {
                return true;
            }

            // Check error message for fetch failures
            const message = error.message.toLowerCase();
            if (message.includes('fetch failed') ||
                message.includes('network') ||
                message.includes('socket') ||
                message.includes('disconnected')) {
                return true;
            }
        }
        return false;
    }

    /**
     * Extract error code from Error or its cause
     */
    private getErrorCode(error: unknown): string | undefined {
        if (error instanceof Error) {
            // Check cause first (Node.js fetch wraps the real error in cause)
            const cause = (error as Error & { cause?: { code?: string } }).cause;
            if (cause?.code) {
                return cause.code;
            }
            // Fall back to direct code property
            const directCode = (error as Error & { code?: string }).code;
            if (directCode) {
                return directCode;
            }
        }
        return undefined;
    }

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

        const response = await this.fetchWithRetry(this.GQL_ENDPOINT, {
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

            const response = await this.fetchWithRetry(this.GQL_ENDPOINT, {
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

            // Map all qualities for the player to use
            const mappedQualities = sortedQualities.map(q => ({
                quality: q.quality + 'p', // Append 'p' e.g. "1080p"
                // Append sig and token to EACH url to make it playable
                url: `${q.sourceURL}?sig=${accessToken.signature}&token=${encodeURIComponent(accessToken.value)}`,
                frameRate: q.frameRate
            }));

            return {
                url: finalUrl,
                format: 'mp4',
                qualities: mappedQualities
            };
        } catch (error) {
            console.error('Failed to get clip playback URL:', clipSlug, error);
            throw error;
        }
    }
}
