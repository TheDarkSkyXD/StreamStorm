import { StreamPlayback } from '../../../../components/player/types';
import { KICK_LEGACY_API_V1_BASE } from './kick-types';

export class KickStreamResolver {

    /**
     * Get playback URL for a Kick live stream
     * Uses the public v1 channel endpoint which typically includes the HLS playback URL
     */
    async getStreamPlaybackUrl(channelSlug: string): Promise<StreamPlayback> {
        try {
            const response = await fetch(`${KICK_LEGACY_API_V1_BASE}/channels/${channelSlug}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://kick.com/',
                    'Origin': 'https://kick.com'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Channel not found');
                }
                throw new Error(`Kick API error: ${response.status}`);
            }

            const data = await response.json();

            // Check if livestream exists
            if (!data.livestream && !data.playback_url) {
                throw new Error('Channel is offline or restricted');
            }

            // The playback URL is usually in data.playback_url
            // Some responses might place it inside livestream object, but usually root for this endpoint
            const playbackUrl = data.playback_url || data.livestream?.source || null;

            if (!playbackUrl) {
                throw new Error('No playback URL found in response');
            }

            return {
                url: playbackUrl,
                format: 'hls'
            };

        } catch (error) {
            console.error('Failed to resolve Kick stream URL for:', channelSlug, error);
            throw error;
        }
    }
}
