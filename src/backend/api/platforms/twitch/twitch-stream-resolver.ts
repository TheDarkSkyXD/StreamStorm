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
     * Get playback URL for a live stream
     */
    async getStreamPlaybackUrl(channelLogin: string): Promise<StreamPlayback> {
        try {
            const token = await this.getPlaybackAccessToken(channelLogin, false);
            const url = this.constructHlsUrl(channelLogin, token.value, token.signature);
            return {
                url,
                format: 'hls'
            };
        } catch (error) {
            console.error('Failed to resolve Twitch stream URL for:', channelLogin, error);
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
}
