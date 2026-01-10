/**
 * Twitch Proxy Service
 *
 * Service for constructing proxied Twitch stream URLs to bypass ads.
 * Uses the same URL format as Twire Android app.
 *
 * URL Format: {proxyBase}/playlist/{encodedParams}
 * where encodedParams = encodeURIComponent("{channel}.m3u8?allow_source=true&allow_audio_only=true&fast_bread=true")
 *
 * @see https://github.com/twireapp/Twire
 */

import { StreamProxyConfig, getProxyUrl } from '../../../../shared/proxy-types';
import { StreamPlayback } from './twitch-types';

/**
 * Custom error class for proxy configuration issues.
 * Allows callers to distinguish between different failure modes.
 */
export class ProxyConfigError extends Error {
    constructor(
        message: string,
        public readonly code: 'disabled' | 'invalid_custom_url' | 'not_configured'
    ) {
        super(message);
        this.name = 'ProxyConfigError';
    }
}

/**
 * Service for constructing proxied Twitch stream URLs.
 * Uses the same URL format as Twire Android app.
 */
export class TwitchProxyService {
    private config: StreamProxyConfig;

    constructor(config: StreamProxyConfig) {
        this.config = config;
    }

    /**
     * Get proxied stream URL for a channel.
     *
     * Matches Twire's GetStreamURL.kt logic:
     * ```kotlin
     * val parameters = "$channelOrVod.m3u8?allow_source=true&allow_audio_only=true&fast_bread=true"
     * streamUrl = "$proxy/playlist/${safeEncode(parameters)}"
     * ```
     *
     * @param channelLogin - The channel login/username (lowercase)
     * @returns StreamPlayback object with proxied URL
     * @throws {ProxyConfigError} When proxy is disabled or custom URL is invalid
     */
    getProxiedStreamUrl(channelLogin: string): StreamPlayback {
        const proxyBase = getProxyUrl(this.config);

        if (!proxyBase) {
            // Distinguish between "disabled" and "invalid custom URL"
            if (this.config.selectedProxy === 'none') {
                throw new ProxyConfigError('Proxy is disabled', 'disabled');
            }
            if (this.config.selectedProxy === 'custom') {
                throw new ProxyConfigError(
                    'Invalid custom proxy URL. Please check your settings.',
                    'invalid_custom_url'
                );
            }
            throw new ProxyConfigError('No proxy configured', 'not_configured');
        }

        // Try simpler URL format - just channel name path
        // Some proxies expect: {proxyBase}/playlist/{channel}.m3u8
        // Others expect: {proxyBase}/playlist/{encodedParams}
        // Let's try the simpler format first which might work better
        const channel = channelLogin.toLowerCase();

        // Try format: {base}/playlist/{channel}.m3u8 (simpler, used by some proxies)
        // Instead of encoding the whole thing, just use the channel name
        const url = `${proxyBase}/playlist/${channel}.m3u8?allow_source=true&allow_audio_only=true&fast_bread=true`;

        console.debug(`[TwitchProxyService] Constructed proxy URL for ${channelLogin}`);
        console.debug(`[TwitchProxyService] URL: ${url}`);

        return {
            url,
            format: 'hls',
        };
    }

    /**
     * Test if the proxy server is reachable.
     * Uses GET request for wider compatibility (not all proxies support HEAD).
     * A 2xx-4xx response indicates the server is reachable; 5xx or network errors mean it's down.
     *
     * @returns Object with success flag, optional latency in ms, and optional error message
     */
    async testConnection(): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
        const proxyBase = getProxyUrl(this.config);

        if (!proxyBase) {
            return { success: false, error: 'No proxy configured' };
        }

        try {
            const start = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(proxyBase, {
                method: 'GET', // Use GET instead of HEAD for wider compatibility
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const latencyMs = Date.now() - start;

            // 2xx-4xx means server is reachable; 5xx means server error
            if (response.status >= 500) {
                return {
                    success: false,
                    latencyMs,
                    error: `Server error: ${response.status}`,
                };
            }

            return {
                success: true,
                latencyMs,
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Connection timeout (5s)',
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }

    /**
     * Get the currently configured proxy URL (for debugging/display)
     */
    getConfiguredProxyUrl(): string | null {
        return getProxyUrl(this.config);
    }
}
