/**
 * Stream Proxy Configuration Types
 *
 * Shared type definitions for Twitch ad-blocking proxy functionality.
 * Based on the Twire Android app proxy implementation.
 *
 * @see https://github.com/twireapp/Twire
 */

/**
 * Predefined proxy endpoints from Twire's arrays.xml
 * These are the exact same proxy servers used by Twire.
 */
export const TWITCH_PROXY_SERVERS = [
    // Disabled (empty string)
    { id: 'none', label: 'Disabled', url: '' },

    // TTV LOL PRO servers (cdn-perfprod.com)
    { id: 'ttv-lol-eu', label: 'TTV LOL PRO - EU', url: 'https://lb-eu.cdn-perfprod.com' },
    { id: 'ttv-lol-eu2', label: 'TTV LOL PRO - EU 2', url: 'https://lb-eu2.cdn-perfprod.com' },
    { id: 'ttv-lol-eu3', label: 'TTV LOL PRO - EU 3', url: 'https://lb-eu3.cdn-perfprod.com' },
    { id: 'ttv-lol-eu4', label: 'TTV LOL PRO - EU 4', url: 'https://lb-eu4.cdn-perfprod.com' },
    { id: 'ttv-lol-eu5', label: 'TTV LOL PRO - EU 5', url: 'https://lb-eu5.cdn-perfprod.com' },
    { id: 'ttv-lol-na', label: 'TTV LOL PRO - North America', url: 'https://lb-na.cdn-perfprod.com' },
    { id: 'ttv-lol-as', label: 'TTV LOL PRO - Asia', url: 'https://lb-as.cdn-perfprod.com' },
    { id: 'ttv-lol-sa', label: 'TTV LOL PRO - South America', url: 'https://lb-sa.cdn-perfprod.com' },

    // Luminous servers (luminous.dev)
    { id: 'luminous-eu', label: 'Luminous - EU', url: 'https://eu.luminous.dev' },
    { id: 'luminous-eu2', label: 'Luminous - EU 2', url: 'https://eu2.luminous.dev' },
    { id: 'luminous-as', label: 'Luminous - Asia', url: 'https://as.luminous.dev' },

    // Custom (user-provided)
    { id: 'custom', label: 'Custom Proxy', url: 'custom' },
] as const;

/**
 * Valid proxy server IDs derived from TWITCH_PROXY_SERVERS
 */
export type ProxyServerId = (typeof TWITCH_PROXY_SERVERS)[number]['id'];

/**
 * Stream proxy configuration for Twitch ad blocking.
 * Matches the proxy system used by Twire Android app.
 */
export interface StreamProxyConfig {
    /**
     * Selected proxy server ID from TWITCH_PROXY_SERVERS
     * Use 'none' to disable, 'custom' for user-provided URL
     */
    selectedProxy: ProxyServerId;

    /**
     * Custom proxy URL when selectedProxy is 'custom'
     * Format: https://your-proxy.com (without /playlist path)
     */
    customProxyUrl?: string;

    /**
     * Fall back to direct Twitch stream if proxy fails
     * @default true
     */
    fallbackToDirect: boolean;
}

/**
 * Default stream proxy configuration (disabled by default)
 */
export const DEFAULT_STREAM_PROXY_CONFIG: StreamProxyConfig = {
    selectedProxy: 'none',
    fallbackToDirect: true,
};

/**
 * Validate if a string is a valid HTTPS URL for proxy use
 *
 * @param url - The URL string to validate
 * @returns Object with valid flag and optional error message
 */
export function isValidProxyUrl(url: string): { valid: boolean; error?: string } {
    const trimmed = url?.trim();

    if (!trimmed) {
        return { valid: false, error: 'URL is required' };
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:') {
            return { valid: false, error: 'Proxy must use HTTPS protocol' };
        }
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}

/**
 * Get the actual proxy URL for a given proxy configuration.
 * Validates custom URLs and returns null if invalid or disabled.
 *
 * @param config - The stream proxy configuration
 * @returns The proxy base URL, or null if disabled/invalid
 */
export function getProxyUrl(config: StreamProxyConfig): string | null {
    if (config.selectedProxy === 'none') {
        return null;
    }

    if (config.selectedProxy === 'custom') {
        const url = config.customProxyUrl?.trim();
        if (!url) return null;

        // Validate URL format (must be valid URL with https protocol)
        const validation = isValidProxyUrl(url);
        if (!validation.valid) {
            console.warn(`[proxy-types] Custom proxy URL invalid: ${validation.error}`);
            return null;
        }
        return url;
    }

    const server = TWITCH_PROXY_SERVERS.find((s) => s.id === config.selectedProxy);
    return server?.url || null;
}
