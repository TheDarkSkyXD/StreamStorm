/**
 * Twitch Ad-Block Service
 *
 * Native ad-blocking implementation for Twitch streams.
 *
 * Strategies:
 * 1. Random X-Device-Id header - Makes device appear as "new" user
 * 2. Alternative playerType values - Different ad loads per type
 * 3. Platform spoofing (web/ios/android) - Different ad systems
 * 4. Backup token fetching with fallback playerTypes
 */

import {
    AdBlockConfig,
    TwitchAdBlockConfig,
    PlayerType,
    generateRandomDeviceId,
} from '../../../../shared/adblock-types';

export class TwitchAdBlockService {
    private readonly GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    private readonly GQL_ENDPOINT = 'https://gql.twitch.tv/gql';

    /**
     * Get modified headers for playback access token request.
     * Adds X-Device-Id header when configured.
     */
    getModifiedHeaders(config: TwitchAdBlockConfig): Record<string, string> {
        const headers: Record<string, string> = {
            'Client-Id': this.GQL_CLIENT_ID,
            'Content-Type': 'application/json',
        };

        if (config.useRandomDeviceId) {
            headers['X-Device-Id'] = generateRandomDeviceId();
            console.log('[TwitchAdBlock] Using random X-Device-Id');
        }

        return headers;
    }

    /**
     * Get playback access token with ad-blocking modifications.
     *
     * @param channelLogin - The channel login name (for live streams)
     * @param config - Ad-block configuration
     * @param isVod - Whether this is a VOD request
     * @param vodId - The VOD ID (required if isVod is true)
     */
    async getPlaybackAccessToken(
        channelLogin: string,
        config: TwitchAdBlockConfig,
        isVod: boolean = false,
        vodId?: string
    ): Promise<{ value: string; signature: string }> {
        const headers = this.getModifiedHeaders(config);
        const playerType = config.playerType;
        const platform = config.platform;

        const query = `
            query PlaybackAccessToken($login: String!, $vodID: ID!, $isVod: Boolean!, $playerType: String!, $platform: String!) {
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
            login: isVod ? '' : channelLogin.toLowerCase(),
            isVod,
            vodID: isVod ? (vodId || channelLogin) : '',
            playerType,
            platform,
        };

        console.log(`[TwitchAdBlock] Fetching token: playerType=${playerType}, platform=${platform}, randomDeviceId=${config.useRandomDeviceId}`);

        const response = await fetch(this.GQL_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            throw new Error(`GQL request failed: ${response.status}`);
        }

        const json = await response.json();

        if (json.errors) {
            throw new Error(`GQL Errors: ${JSON.stringify(json.errors)}`);
        }

        const data = json.data;
        const token = isVod
            ? data.videoPlaybackAccessToken
            : data.streamPlaybackAccessToken;

        if (!token) {
            throw new Error('No playback access token returned');
        }

        return token;
    }

    /**
     * Try multiple playerType values until one returns a token.
     * Used as fallback when primary strategy fails or to find ad-free streams.
     *
     * @param channelLogin - The channel login name
     * @param backupPlayerTypes - List of playerTypes to try
     * @param baseConfig - Base ad-block configuration
     */
    async tryBackupPlayerTypes(
        channelLogin: string,
        backupPlayerTypes: PlayerType[],
        baseConfig: TwitchAdBlockConfig
    ): Promise<{ value: string; signature: string; usedPlayerType: string } | null> {
        for (const playerType of backupPlayerTypes) {
            try {
                const modifiedConfig: TwitchAdBlockConfig = {
                    ...baseConfig,
                    playerType,
                };
                const token = await this.getPlaybackAccessToken(channelLogin, modifiedConfig);
                console.log(`[TwitchAdBlock] Backup playerType=${playerType} succeeded`);
                return { ...token, usedPlayerType: playerType };
            } catch (error) {
                console.log(`[TwitchAdBlock] Backup playerType=${playerType} failed:`, error);
                continue;
            }
        }
        return null;
    }

    /**
     * Construct HLS URL with ad-blocking parameters.
     *
     * @param channel - Channel login name
     * @param token - Playback access token
     * @param sig - Token signature
     * @param includeFastBread - Whether to include fast_bread=true for lower latency
     */
    constructHlsUrl(
        channel: string,
        token: string,
        sig: string,
        includeFastBread: boolean = true
    ): string {
        const p = Math.floor(Math.random() * 999999);
        let url = `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?` +
            `token=${encodeURIComponent(token)}` +
            `&sig=${sig}` +
            `&allow_source=true` +
            `&allow_audio_only=true` +
            `&p=${p}`;

        if (includeFastBread) {
            url += '&fast_bread=true';
        }

        return url;
    }

    /**
     * Construct VOD URL with standard parameters.
     *
     * @param vodId - VOD ID
     * @param token - Playback access token
     * @param sig - Token signature
     */
    constructVodUrl(vodId: string, token: string, sig: string): string {
        return `https://usher.ttvnw.net/vod/${vodId}.m3u8?` +
            `nauth=${encodeURIComponent(token)}` +
            `&nauthsig=${sig}` +
            `&allow_source=true` +
            `&allow_audio_only=true`;
    }
}

export const twitchAdBlockService = new TwitchAdBlockService();
