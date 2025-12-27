/**
 * HEVC Codec Detection and Swapping Utility
 *
 * Handles HEVC (H.265) to AVC (H.264) codec swapping for 2K/4K streams.
 * Some browsers (especially Chrome) may not fully support HEVC playback,
 * so we detect HEVC variants and can swap them to AVC equivalents.
 *
 * Based on VAFT codec handling (lines 329-355)
 */

import { type ResolutionInfo } from '@/shared/adblock-types';

/**
 * Codec patterns for detection
 */
const CODEC_PATTERNS = {
    /** HEVC/H.265 codec identifiers */
    hevc: ['hvc1', 'hev1', 'hevc', 'h265', 'h.265'],
    /** AVC/H.264 codec identifiers */
    avc: ['avc1', 'avc3', 'h264', 'h.264'],
    /** VP9 codec identifiers */
    vp9: ['vp09', 'vp9'],
    /** AV1 codec identifiers */
    av1: ['av01', 'av1'],
};

/**
 * Result of HEVC detection in a variant stream
 */
export interface HevcDetectionResult {
    /** Whether the variant uses HEVC codec */
    isHevc: boolean;
    /** The original codec string if present */
    originalCodec?: string;
    /** The detected codec type */
    codecType: 'hevc' | 'avc' | 'vp9' | 'av1' | 'unknown';
}

/**
 * Check if a codec string indicates HEVC/H.265
 *
 * @param codecs - The codec string from EXT-X-STREAM-INF CODECS attribute
 * @returns HevcDetectionResult with detection details
 */
export function detectHevcCodec(codecs: string | undefined): HevcDetectionResult {
    if (!codecs) {
        return {
            isHevc: false,
            codecType: 'unknown',
        };
    }

    const codecsLower = codecs.toLowerCase();

    // Check for HEVC first
    for (const pattern of CODEC_PATTERNS.hevc) {
        if (codecsLower.includes(pattern)) {
            return {
                isHevc: true,
                originalCodec: codecs,
                codecType: 'hevc',
            };
        }
    }

    // Check other codecs
    for (const pattern of CODEC_PATTERNS.avc) {
        if (codecsLower.includes(pattern)) {
            return {
                isHevc: false,
                originalCodec: codecs,
                codecType: 'avc',
            };
        }
    }

    for (const pattern of CODEC_PATTERNS.vp9) {
        if (codecsLower.includes(pattern)) {
            return {
                isHevc: false,
                originalCodec: codecs,
                codecType: 'vp9',
            };
        }
    }

    for (const pattern of CODEC_PATTERNS.av1) {
        if (codecsLower.includes(pattern)) {
            return {
                isHevc: false,
                originalCodec: codecs,
                codecType: 'av1',
            };
        }
    }

    return {
        isHevc: false,
        originalCodec: codecs,
        codecType: 'unknown',
    };
}

/**
 * Check if the browser supports HEVC playback
 *
 * @returns Promise that resolves to true if HEVC is supported
 */
export async function checkHevcSupport(): Promise<boolean> {
    // Check MediaSource support for HEVC
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported) {
        // Try common HEVC MIME types
        const hevcTypes = [
            'video/mp4; codecs="hvc1.1.6.L93.B0"',
            'video/mp4; codecs="hev1.1.6.L93.B0"',
            'video/mp4; codecs="hvc1"',
            'video/mp4; codecs="hev1"',
        ];

        for (const type of hevcTypes) {
            if (MediaSource.isTypeSupported(type)) {
                console.log('[HevcHandler] Browser supports HEVC:', type);
                return true;
            }
        }
    }

    // Check video element canPlayType as fallback
    try {
        const video = document.createElement('video');
        const canPlay = video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"');
        if (canPlay === 'probably' || canPlay === 'maybe') {
            console.log('[HevcHandler] Video element reports HEVC support:', canPlay);
            return true;
        }
    } catch (error) {
        console.warn('[HevcHandler] Error checking HEVC support:', error);
    }

    console.log('[HevcHandler] Browser does not support HEVC');
    return false;
}

/**
 * Filter variant streams to exclude HEVC when not supported.
 * Returns AVC variants that can be used as alternatives.
 *
 * @param variants - Array of variant streams from master playlist
 * @param preferAvc - If true, always filter out HEVC even if supported
 * @returns Filtered array of variants without HEVC (or original if all are HEVC)
 */
export function filterHevcVariants(
    variants: ResolutionInfo[],
    preferAvc: boolean = false
): ResolutionInfo[] {
    if (!preferAvc) {
        // Return all variants if not forcing AVC
        return variants;
    }

    // Separate AVC and HEVC variants
    const avcVariants: ResolutionInfo[] = [];
    const hevcVariants: ResolutionInfo[] = [];

    for (const variant of variants) {
        const detection = detectHevcCodec(variant.codecs);
        if (detection.isHevc) {
            hevcVariants.push(variant);
        } else {
            avcVariants.push(variant);
        }
    }

    // If we have AVC variants, use them; otherwise fall back to HEVC
    if (avcVariants.length > 0) {
        console.log(`[HevcHandler] Using ${avcVariants.length} AVC variants (filtered ${hevcVariants.length} HEVC)`);
        return avcVariants;
    }

    console.log('[HevcHandler] No AVC variants available, using HEVC variants');
    return hevcVariants;
}

/**
 * Find the best AVC alternative for an HEVC variant.
 * Looks for an AVC variant with similar resolution.
 *
 * @param hevcVariant - The HEVC variant to find an alternative for
 * @param allVariants - All available variants
 * @returns The best matching AVC variant, or null if none found
 */
export function findAvcAlternative(
    hevcVariant: ResolutionInfo,
    allVariants: ResolutionInfo[]
): ResolutionInfo | null {
    const targetPixels = hevcVariant.width * hevcVariant.height;
    let bestMatch: ResolutionInfo | null = null;
    let bestDiff = Infinity;

    for (const variant of allVariants) {
        const detection = detectHevcCodec(variant.codecs);
        if (detection.isHevc) {
            continue; // Skip other HEVC variants
        }

        const candidatePixels = variant.width * variant.height;
        const diff = Math.abs(candidatePixels - targetPixels);

        if (diff < bestDiff) {
            bestMatch = variant;
            bestDiff = diff;
        }
    }

    if (bestMatch) {
        console.log(
            `[HevcHandler] Found AVC alternative: ${bestMatch.resolution} ` +
            `(target was ${hevcVariant.resolution} HEVC)`
        );
    }

    return bestMatch;
}

/**
 * Swap HEVC variants to AVC in a master M3U8 playlist.
 * This modifies the playlist content to use AVC URLs instead of HEVC.
 *
 * @param masterM3u8 - The raw master playlist content
 * @param variants - Parsed variant information
 * @param forceAvc - If true, replace all HEVC URLs with AVC alternatives
 * @returns Modified playlist content (or original if no swap needed)
 */
export function swapHevcToAvc(
    masterM3u8: string,
    variants: ResolutionInfo[],
    forceAvc: boolean = false
): { content: string; swapped: boolean; swapCount: number } {
    if (!forceAvc) {
        return { content: masterM3u8, swapped: false, swapCount: 0 };
    }

    let swapCount = 0;
    let modifiedContent = masterM3u8;

    for (const variant of variants) {
        const detection = detectHevcCodec(variant.codecs);
        if (!detection.isHevc) {
            continue;
        }

        // Find AVC alternative
        const avcAlt = findAvcAlternative(variant, variants);
        if (avcAlt && avcAlt.url !== variant.url) {
            // Replace the HEVC URL with AVC URL in the playlist
            modifiedContent = modifiedContent.replace(variant.url, avcAlt.url);
            swapCount++;
        }
    }

    if (swapCount > 0) {
        console.log(`[HevcHandler] Swapped ${swapCount} HEVC variant(s) to AVC`);
    }

    return {
        content: modifiedContent,
        swapped: swapCount > 0,
        swapCount,
    };
}

/**
 * Check if a master playlist contains any HEVC variants.
 *
 * @param variants - Parsed variant information
 * @returns Object with HEVC detection summary
 */
export function analyzePlaylistCodecs(variants: ResolutionInfo[]): {
    hasHevc: boolean;
    hasAvc: boolean;
    hevcCount: number;
    avcCount: number;
    summary: string;
} {
    let hevcCount = 0;
    let avcCount = 0;

    for (const variant of variants) {
        const detection = detectHevcCodec(variant.codecs);
        if (detection.isHevc) {
            hevcCount++;
        } else if (detection.codecType === 'avc') {
            avcCount++;
        }
    }

    const summary = `Playlist has ${avcCount} AVC and ${hevcCount} HEVC variants`;

    return {
        hasHevc: hevcCount > 0,
        hasAvc: avcCount > 0,
        hevcCount,
        avcCount,
        summary,
    };
}
