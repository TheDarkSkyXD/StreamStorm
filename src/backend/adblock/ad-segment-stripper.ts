/**
 * Ad Segment Stripping Utility
 *
 * Strips ad segments from HLS M3U8 playlists by replacing ad segment URLs
 * with a tiny placeholder video. This approach:
 * 1. Preserves playlist timing and structure
 * 2. Allows seamless transition back to live content
 * 3. Avoids playback interruptions
 *
 * Based on VAFT stripAdSegments (lines 391-430)
 */

import { isAdSegment, isLiveSegment } from '@/shared/adblock-types';

/**
 * Base64-encoded tiny MP4 placeholder video (about 500 bytes)
 * This is a minimal valid MP4 file that plays as black silence.
 * From VAFT line 246: Used as replacement for ad segments.
 */
export const PLACEHOLDER_VIDEO_BASE64 =
    'AAAAKGZ0eXBtcDQyAAAAAWlzb21tcDQyZGFzaGF2YzFpc282aGxzZgAABEltb292' +
    'AAAAbG12aGQAAAAAAAAAAAAAAAAAAYagAAAAAAABAAABAAAAAAAAAAAAAAAAAQAA' +
    'AAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAADAAABqHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAA' +
    'AAAAAEAAAAAAAAAAAAAAAAAAAURtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuA' +
    'AAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFu' +
    'ZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAA' +
    'AAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0' +
    'YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAALuAAAAAAAAzZXNkcwAAAAADgICAIgAB' +
    'AASAgIAUQBUAAAAAAAAAAAAAAAWAgIACEZAGgICAAQIAAAAQc3R0cwAAAAAAAAAA' +
    'AAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAA' +
    'AAAAAAAAAeV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAA' +
    'AoAAAAFoAAAAAAGBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAA9CQAAAAABVxAAA' +
    'AAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAAB' +
    'LG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAA' +
    'AQAAAAx1cmwgAAAAAQAAAOxzdGJsAAAAoHN0c2QAAAAAAAAAAQAAAJBhdmMxAAAA' +
    'AAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAOmF2Y0MBTUAe/+EAI2dNQB6W' +
    'UoFAX/LgLUBAQFAAAD6AAA6mDgAAHoQAA9CW7y4KAQAEaOuPIAAAABBzdHRzAAAA' +
    'AAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3Rj' +
    'bwAAAAAAAAAAAAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAC4AAAAAAoAA' +
    'AAAAACB0cmV4AAAAAAAAAAIAAAABAACCNQAAAAACQAAA';

/**
 * Placeholder video as a data URL
 */
export const PLACEHOLDER_VIDEO_URL = `data:video/mp4;base64,${PLACEHOLDER_VIDEO_BASE64}`;

/**
 * Cache of known ad segment URLs to avoid re-processing
 */
export class AdSegmentCache {
    private cache: Map<string, number> = new Map();
    private maxSize: number;
    private cleanupThreshold: number;

    constructor(maxSize: number = 1000) {
        this.maxSize = maxSize;
        this.cleanupThreshold = maxSize * 0.8;
    }

    /**
     * Check if a segment URL is a known ad
     */
    has(url: string): boolean {
        return this.cache.has(url);
    }

    /**
     * Add a segment URL to the ad cache
     */
    add(url: string): void {
        if (this.cache.size >= this.maxSize) {
            this.cleanup();
        }
        this.cache.set(url, Date.now());
    }

    /**
     * Get the count of cached ad segments
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Clear all cached entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove old entries to make room for new ones
     */
    private cleanup(): void {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1] - b[1]);

        const toRemove = entries.slice(0, entries.length - this.cleanupThreshold);
        for (const [url] of toRemove) {
            this.cache.delete(url);
        }
    }
}

/**
 * Result of stripping ad segments from a playlist
 */
export interface StripResult {
    /** Modified M3U8 content with ad segments replaced */
    content: string;
    /** Number of ad segments stripped */
    strippedCount: number;
    /** Number of live segments preserved */
    liveCount: number;
    /** List of stripped segment URLs */
    strippedUrls: string[];
    /** Whether the playlist was modified */
    modified: boolean;
}

/**
 * Strip ad segments from an M3U8 media playlist.
 * Replaces ad segment URLs with a placeholder video URL.
 *
 * @param m3u8Content - The raw M3U8 playlist content
 * @param adCache - Optional cache of known ad segments
 * @param usePlaceholder - If true, replace ads with placeholder; if false, remove entirely
 * @returns StripResult with modified content and statistics
 */
export function stripAdSegments(
    m3u8Content: string,
    adCache?: AdSegmentCache,
    usePlaceholder: boolean = true
): StripResult {
    const lines = m3u8Content.replace(/\r/g, '').split('\n');
    const strippedUrls: string[] = [];
    let strippedCount = 0;
    let liveCount = 0;
    let modified = false;

    let isNextLineAdSegment = false;
    let currentExtinf = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this is an EXTINF line
        if (line.startsWith('#EXTINF')) {
            currentExtinf = line;
            // Check if this segment is an ad (no ',live' suffix)
            isNextLineAdSegment = isAdSegment(line);
            continue;
        }

        // Check if this is a segment URL (non-comment, non-empty after EXTINF)
        if (!line.startsWith('#') && line.trim() && currentExtinf) {
            if (isNextLineAdSegment) {
                // This is an ad segment
                strippedCount++;
                strippedUrls.push(line);
                modified = true;

                // Add to cache if provided
                if (adCache) {
                    adCache.add(line);
                }

                if (usePlaceholder) {
                    // Replace with placeholder URL
                    lines[i] = PLACEHOLDER_VIDEO_URL;
                } else {
                    // Remove the segment entirely (clear EXTINF and URL)
                    lines[i - 1] = ''; // Clear EXTINF
                    lines[i] = ''; // Clear URL
                }
            } else if (isLiveSegment(currentExtinf)) {
                liveCount++;
            }

            // Reset state for next segment
            isNextLineAdSegment = false;
            currentExtinf = '';
        }
    }

    const content = usePlaceholder
        ? lines.join('\n')
        : lines.filter(line => line.trim()).join('\n');

    if (strippedCount > 0) {
        console.log(
            `[AdSegmentStripper] Stripped ${strippedCount} ad segment(s), ` +
            `preserved ${liveCount} live segment(s)`
        );
    }

    return {
        content,
        strippedCount,
        liveCount,
        strippedUrls,
        modified,
    };
}

/**
 * Options for the ad-stripping playlist loader
 */
export interface AdStripLoaderOptions {
    /** Whether to strip ad segments */
    enabled: boolean;
    /** Whether to use placeholder video instead of removing segments */
    usePlaceholder: boolean;
    /** Cache for tracking ad segments */
    adCache?: AdSegmentCache;
    /** Callback when ads are stripped */
    onAdsStripped?: (count: number, urls: string[]) => void;
}

/**
 * Create a playlist loader function that strips ad segments.
 * This can be used as a loader for HLS.js or similar players.
 *
 * @param fetchFn - The underlying fetch function to use
 * @param options - Options for ad stripping
 * @returns A loader function compatible with HLS.js pLoader
 */
export function createAdStripLoader(
    fetchFn: typeof fetch = fetch,
    options: AdStripLoaderOptions
): (url: string) => Promise<string> {
    const { enabled, usePlaceholder, adCache, onAdsStripped } = options;

    return async (url: string): Promise<string> => {
        const response = await fetchFn(url);
        let content = await response.text();

        if (enabled && url.includes('.m3u8')) {
            const result = stripAdSegments(content, adCache, usePlaceholder);

            if (result.modified && onAdsStripped) {
                onAdsStripped(result.strippedCount, result.strippedUrls);
            }

            content = result.content;
        }

        return content;
    };
}

/**
 * Process a single segment request during ad blocking.
 * If the URL is a known ad segment, return placeholder instead of fetching.
 *
 * @param segmentUrl - The segment URL to process
 * @param adCache - Cache of known ad segments
 * @returns Object indicating whether to use placeholder
 */
export function shouldUsePlaceholder(
    segmentUrl: string,
    adCache: AdSegmentCache
): { usePlaceholder: boolean; reason: string } {
    if (adCache.has(segmentUrl)) {
        return {
            usePlaceholder: true,
            reason: 'cached_ad_segment',
        };
    }

    // Check URL patterns that indicate ads
    const adUrlPatterns = [
        'amazon-adsystem',
        'doubleclick',
        'googlesyndication',
        'ad-delivery',
    ];

    for (const pattern of adUrlPatterns) {
        if (segmentUrl.toLowerCase().includes(pattern)) {
            return {
                usePlaceholder: true,
                reason: `url_pattern:${pattern}`,
            };
        }
    }

    return {
        usePlaceholder: false,
        reason: 'live_segment',
    };
}

/**
 * Fetch a placeholder segment instead of the actual ad.
 * Returns a Response object that can be used in place of the ad response.
 *
 * @returns Promise resolving to a Response containing the placeholder video
 */
export async function fetchPlaceholderSegment(): Promise<Response> {
    // Convert base64 to binary
    const binaryString = atob(PLACEHOLDER_VIDEO_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return new Response(bytes, {
        status: 200,
        headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(bytes.length),
        },
    });
}
