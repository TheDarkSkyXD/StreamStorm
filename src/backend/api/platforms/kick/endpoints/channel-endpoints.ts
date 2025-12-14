import { KickRequestor } from '../kick-requestor';
import { UnifiedChannel } from '../../../unified/platform-types';
import { KickApiResponse, KickApiChannel, KICK_LEGACY_API_V1_BASE } from '../kick-types';
import { transformKickChannel } from '../kick-transformers';
import { getUsersById } from './user-endpoints';

/**
 * Get channel info by slug
 * https://docs.kick.com/apis/channels - GET /public/v1/channels?slug[]=:slug
 */
export async function getChannel(client: KickRequestor, slug: string): Promise<UnifiedChannel | null> {
    try {
        // Try official API first if we have credentials
        if (client.isAuthenticated()) {
            const response = await client.request<KickApiResponse<KickApiChannel[]>>(
                `/channels?slug[]=${encodeURIComponent(slug)}`
            );
            if (response.data && response.data.length > 0) {
                const channel = transformKickChannel(response.data[0]);

                // Fetch user info to get avatar and display name
                try {
                    const users = await getUsersById(client, [parseInt(channel.id)]);
                    if (users.length > 0) {
                        const user = users[0];
                        if (user.profile_picture) {
                            channel.avatarUrl = user.profile_picture;
                        }
                        if (user.name) {
                            channel.displayName = user.name;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to fetch user info for channel', channel.username);
                }

                return channel;
            }
        }
    } catch (error) {
        console.warn('Failed to fetch Kick channel via official API, trying fallback:', error);
    }

    // Fallback to public/legacy API
    // This is robust against auth failures and provides the necessary data for the UI
    return getPublicChannel(slug);
}

/**
 * Get multiple channels by their slugs
 * https://docs.kick.com/apis/channels - GET /public/v1/channels?slug[]=:slug&slug[]=:slug2
 */
export async function getChannelsBySlugs(client: KickRequestor, slugs: string[]): Promise<UnifiedChannel[]> {
    if (slugs.length === 0) {
        return [];
    }

    try {
        // Max 50 slugs per request
        const limitedSlugs = slugs.slice(0, 50);
        const params = limitedSlugs.map(s => `slug[]=${encodeURIComponent(s)}`).join('&');

        const response = await client.request<KickApiResponse<KickApiChannel[]>>(
            `/channels?${params}`
        );

        return (response.data || []).map(transformKickChannel);
    } catch (error) {
        console.error('Failed to fetch Kick channels:', error);
        return [];
    }
}

/**
 * Get channel info using the public/legacy API (No Auth Required)
 * GET https://kick.com/api/v1/channels/:slug
 */
export async function getPublicChannel(slug: string): Promise<UnifiedChannel | null> {
    try {
        const { net } = require('electron');

        const data = await new Promise<any>((resolve, reject) => {
            const request = net.request({
                method: 'GET',
                url: `${KICK_LEGACY_API_V1_BASE}/channels/${slug}`,
            });

            request.setHeader('Accept', 'application/json');
            request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            request.setHeader('Referer', 'https://kick.com/');
            request.setHeader('X-Requested-With', 'XMLHttpRequest');

            request.on('response', (response: any) => {
                if (response.statusCode === 404) {
                    resolve(null);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Status ${response.statusCode}`));
                    return;
                }

                let body = '';
                response.on('data', (chunk: Buffer) => {
                    body += chunk.toString();
                });

                response.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        // Fallback: If body looks like HTML, we might be blocked
                        console.warn(`[KickChannel] Failed to parse JSON for ${slug}. Preview: ${body.substring(0, 200)}`);
                        reject(new Error('Failed to parse JSON'));
                    }
                });
            });

            request.on('error', (error: Error) => {
                reject(error);
            });

            request.end();
        });


        if (!data) return null;

        // Map the public API response to UnifiedChannel
        const user = data.user || {};

        // Extract the most recent category - try recent_categories first, then livestream categories
        let categoryId: string | undefined;
        let categoryName: string | undefined;

        if (data.recent_categories && data.recent_categories.length > 0) {
            // recent_categories is an array of categories the channel has recently streamed in
            const recentCategory = data.recent_categories[0];
            categoryId = recentCategory?.id?.toString();
            categoryName = recentCategory?.name;
        } else if (data.livestream?.categories && data.livestream.categories.length > 0) {
            // If channel is live or has livestream data, use that category
            const liveCategory = data.livestream.categories[0];
            categoryId = liveCategory?.id?.toString();
            categoryName = liveCategory?.name;
        }

        // Extract the last stream title - try livestream first, then previous_livestreams
        let lastStreamTitle: string | undefined;

        if (data.livestream?.session_title) {
            // Current or most recent livestream title
            lastStreamTitle = data.livestream.session_title;
        } else if (data.previous_livestreams && data.previous_livestreams.length > 0) {
            // Previous livestream title
            lastStreamTitle = data.previous_livestreams[0]?.session_title;
        }

        return {
            id: data.user_id.toString(),
            platform: 'kick',
            username: data.slug,
            displayName: user.username || data.slug,
            avatarUrl: user.profile_pic || '',
            bannerUrl: data.banner_image?.url || undefined,
            bio: user.bio || '',
            isLive: data.livestream !== null,
            isVerified: data.verified?.id !== undefined || false,
            isPartner: false, // Can't easily tell from this endpoint
            categoryId,
            categoryName,
            lastStreamTitle,
        };
    } catch (error) {
        console.warn(`Failed to fetch public Kick channel ${slug}:`, error);
        return null; // Return null on error so fallback can happen if we had one
    }
}

