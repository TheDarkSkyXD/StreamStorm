import { BrowserWindow } from 'electron';
import { KickRequestor } from '../kick-requestor';
import { UnifiedChannel } from '../../../unified/platform-types';
import { KickApiResponse, KickApiChannel, KICK_LEGACY_API_V1_BASE } from '../kick-types';
import { transformKickChannel } from '../kick-transformers';
import { getUsersById } from './user-endpoints';

// Cache for channel data to reduce API calls and prevent 429 errors
const _channelCache = new Map<string, { channel: UnifiedChannel; timestamp: number }>();
const CHANNEL_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Periodically clean expired channel cache entries
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of _channelCache.entries()) {
        if (now - value.timestamp >= CHANNEL_CACHE_TTL) {
            _channelCache.delete(key);
        }
    }
}, 1000 * 60 * 5).unref(); // Clean every 5 minutes

/**
 * Get channel info by slug
 * https://docs.kick.com/apis/channels - GET /public/v1/channels?slug[]=:slug
 * 
 * ROBUST FIX: Uses public API first to avoid authenticated API identity mismatch bugs
 */
export async function getChannel(client: KickRequestor, slug: string): Promise<UnifiedChannel | null> {
    const normalizedSlug = slug.toLowerCase().trim();

    // Check cache first to reduce API calls and avoid 429 errors
    const cached = _channelCache.get(normalizedSlug);
    if (cached && (Date.now() - cached.timestamp < CHANNEL_CACHE_TTL)) {
        return cached.channel;
    }

    // STRATEGY: Use public API first as it's more reliable and doesn't have identity mismatch bugs
    // The authenticated API has a known bug where it sometimes returns the authenticated user's
    // own channel data instead of the requested channel when using single-slug queries

    try {
        const publicChannel = await getPublicChannel(slug);
        if (publicChannel) {
            // Cache successful result
            _channelCache.set(normalizedSlug, {
                channel: publicChannel,
                timestamp: Date.now()
            });
            return publicChannel;
        }
    } catch (error) {
        console.warn(`[Kick] Public API failed for channel ${slug}, trying authenticated API:`, error);
    }

    // Fallback to official API only if public API fails
    // This is less likely to be reached, but provides a backup path
    try {
        if (client.isAuthenticated()) {
            const response = await client.request<KickApiResponse<KickApiChannel[]>>(
                `/channels?slug[]=${encodeURIComponent(slug)}`
            );

            if (response.data && response.data.length > 0) {
                const apiChannel = response.data[0];

                // CRITICAL: Multi-field validation to ensure we got the correct channel
                // Check both slug AND that it's not empty/null
                if (!apiChannel.slug || apiChannel.slug.toLowerCase() !== normalizedSlug) {
                    console.warn(
                        `[Kick] API identity mismatch: requested "${slug}", got "${apiChannel.slug || 'null'}". ` +
                        `This indicates a Kick API bug. Rejecting response.`
                    );
                    return null;
                }

                const channel = transformKickChannel(apiChannel);

                // Validate transformed channel data
                if (channel.username.toLowerCase() !== normalizedSlug) {
                    console.warn(
                        `[Kick] Post-transform validation failed: channel username "${channel.username}" ` +
                        `doesn't match requested slug "${slug}". Rejecting.`
                    );
                    return null;
                }

                // Fetch user info to get avatar and display name
                // Use defensive approach to handle user ID mismatches
                try {
                    const channelIdNum = parseInt(channel.id);
                    if (isNaN(channelIdNum)) {
                        console.warn(`[Kick] Invalid channel ID "${channel.id}" for ${slug}`);
                    } else {
                        const users = await getUsersById(client, [channelIdNum]);
                        if (users.length > 0) {
                            const user = users[0];

                            // CRITICAL: Triple-check that the user ID matches the channel ID
                            // This prevents propagating incorrect user data
                            if (user.user_id.toString() === channel.id) {
                                if (user.profile_picture) {
                                    channel.avatarUrl = user.profile_picture;
                                }
                                if (user.name) {
                                    channel.displayName = user.name;
                                }
                            } else {
                                console.warn(
                                    `[Kick] User ID mismatch for channel ${slug}: ` +
                                    `fetched user ID ${user.user_id}, expected ${channel.id}. ` +
                                    `Skipping user data enrichment.`
                                );
                            }
                        }
                    }
                } catch (e) {
                    console.debug(`Failed to enrich user info for channel ${slug}:`, e);
                    // Not critical - channel data is still valid without user enrichment
                }

                // Cache successful result
                _channelCache.set(normalizedSlug, {
                    channel,
                    timestamp: Date.now()
                });

                return channel;
            }
        }
    } catch (error) {
        console.warn(`[Kick] Authenticated API failed for channel ${slug}:`, error);
    }

    // Both APIs failed
    return null;
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
 * 
 * Uses a hidden Electron BrowserWindow to bypass Cloudflare/WAF 403 protections.
 */
export async function getPublicChannel(slug: string): Promise<UnifiedChannel | null> {
    let win: BrowserWindow | null = null;
    try {
        const url = `${KICK_LEGACY_API_V1_BASE}/channels/${slug}`;

        // Create a hidden window
        win = new BrowserWindow({
            show: false,
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                partition: 'persist:kick_public' // Use a persistent partition to cache Cloudflare tokens
            }
        });

        // Set a timeout for page load
        const loadTimeout = 15000; // 15 seconds
        const loadPromise = win.loadURL(url);
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Page load timeout')), loadTimeout)
        );

        await Promise.race([loadPromise, timeoutPromise]);

        // Extract JSON content from the page body
        const pageContent = await win.webContents.executeJavaScript(`
            document.body.innerText;
        `);

        if (!pageContent) {
            console.warn(`[KickChannel] Empty response for ${slug}`);
            return null;
        }

        // Check for common HTTP error responses before attempting JSON parse
        const pageContentLower = pageContent.toLowerCase();
        if (pageContentLower.includes('error code 5') ||
            pageContentLower.includes('internal server error') ||
            pageContentLower.includes('bad gateway') ||
            pageContentLower.includes('service unavailable')) {
            console.warn(`[KickChannel] Server error for ${slug}: ${pageContent.substring(0, 100)}`);
            return null;
        }

        let data;
        try {
            data = JSON.parse(pageContent);
        } catch (e) {
            // Check for Cloudflare challenge or error pages
            const title = win.title;
            if (title.includes('Just a moment') || title.includes('Access denied')) {
                console.warn(`[KickChannel] Cloudflare challenge triggered for ${slug}`);
            } else if (pageContent.includes('404')) {
                return null;
            }
            console.warn(`[KickChannel] Failed to parse JSON for ${slug}. Content preview: ${pageContent.substring(0, 100)}`);
            return null;
        }

        if (data.message === 'Not found' || (data.code === 404)) {
            return null;
        }

        // Map the public API response to UnifiedChannel
        const user = data.user || {};

        // Extract the most recent category
        let categoryId: string | undefined;
        let categoryName: string | undefined;

        if (data.recent_categories && data.recent_categories.length > 0) {
            const recentCategory = data.recent_categories[0];
            categoryId = recentCategory?.id?.toString();
            categoryName = recentCategory?.name;
        } else if (data.livestream?.categories && data.livestream.categories.length > 0) {
            const liveCategory = data.livestream.categories[0];
            categoryId = liveCategory?.id?.toString();
            categoryName = liveCategory?.name;
        }

        // Extract the last stream title
        let lastStreamTitle: string | undefined;

        if (data.livestream?.session_title) {
            lastStreamTitle = data.livestream.session_title;
        } else if (data.previous_livestreams && data.previous_livestreams.length > 0) {
            lastStreamTitle = data.previous_livestreams[0]?.session_title;
        }

        const userId = data.user_id || data.id;
        if (!userId) {
            console.warn(`[KickChannel] Missing user_id/id for ${slug}`);
            return null;
        }

        return {
            id: userId.toString(),
            platform: 'kick',
            username: data.slug || slug,
            displayName: user.username || data.slug,
            avatarUrl: user.profile_pic || '',
            // Try to extract a responsive WebP image from srcset as they may bypass CDN restrictions
            // The srcset contains URLs like: "url1 1200w, url2 1003w, ..."
            // We pick the largest one (first in the list)
            bannerUrl: (() => {
                if (!data.offline_banner_image) return undefined;

                // Try srcset first (responsive WebP images)
                if (data.offline_banner_image.srcset) {
                    const srcset = data.offline_banner_image.srcset;
                    // Extract first URL from srcset (format: "url 1200w, url2 1003w, ...")
                    const firstUrl = srcset.split(',')[0]?.trim().split(' ')[0];
                    if (firstUrl) {
                        return firstUrl;
                    }
                }

                // Fall back to src/url
                return data.offline_banner_image.src ||
                    data.offline_banner_image.url ||
                    (typeof data.offline_banner_image === 'string' ? data.offline_banner_image : undefined);
            })(),
            bio: user.bio || '',
            isLive: data.livestream !== null,
            isVerified: data.verified?.id !== undefined || false,
            isPartner: false, // Can't easily tell from this endpoint
            followerCount: data.followers_count ?? data.followersCount ?? undefined,
            categoryId,
            categoryName,
            lastStreamTitle,
        };

    } catch (error) {
        console.warn(`Failed to fetch public Kick channel ${slug} via Window:`, error);
        return null;
    } finally {
        if (win) {
            try {
                win.destroy();
            } catch (e) {
                // ignore
            }
        }
    }
}
