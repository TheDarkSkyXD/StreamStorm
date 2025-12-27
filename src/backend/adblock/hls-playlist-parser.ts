/**
 * HLS Playlist Parser for Ad Detection
 *
 * Parses HLS M3U8 playlists to extract ad-related metadata from:
 * 1. #EXT-X-DATERANGE tags (Twitch stitched ads metadata)
 * 2. Segment titles containing ad network identifiers
 * 3. Timing information to know when ads start/end
 *
 * Based on Xtra's ExoPlayerFragment.kt implementation (lines 266-343)
 */

import {
    AD_DATERANGE_PATTERNS,
    AD_SEGMENT_PATTERNS,
} from '@/shared/adblock-types';

// ========== Interfaces ==========

/**
 * Parsed EXT-X-DATERANGE tag information
 */
export interface DateRange {
    /** Unique ID for this date range (e.g., "stitched-ad-12345") */
    id: string;
    /** CLASS attribute if present (e.g., "twitch-stitched-ad") */
    rangeClass?: string;
    /** Start date in ISO format */
    startDate: string;
    /** End date in ISO format (optional) */
    endDate?: string;
    /** Duration in seconds (from DURATION attribute) */
    duration?: number;
    /** Planned duration in seconds (from PLANNED-DURATION attribute) */
    plannedDuration?: number;
    /** Whether this date range represents an ad */
    isAd: boolean;
    /** All custom attributes (X-*) */
    customAttributes: Record<string, string>;
    /** Start time in microseconds (Unix epoch) */
    startTimeUs: number;
    /** End time in microseconds (Unix epoch), calculated from duration if needed */
    endTimeUs?: number;
}

/**
 * Parsed segment information
 */
export interface Segment {
    /** Segment URI/URL */
    uri: string;
    /** Segment duration in seconds */
    duration: number;
    /** Segment title from EXTINF (may contain ad network identifiers) */
    title?: string;
    /** Program date time if EXT-X-PROGRAM-DATE-TIME is present */
    programDateTime?: string;
    /** Whether this segment appears to be an ad based on title */
    isAdByTitle: boolean;
    /** Relative start time in microseconds from playlist start */
    relativeStartTimeUs: number;
    /** Sequence number */
    sequenceNumber: number;
}

/**
 * Parsed media playlist information
 */
export interface MediaPlaylist {
    /** Target duration in seconds */
    targetDuration: number;
    /** Media sequence number */
    mediaSequence: number;
    /** All parsed EXT-X-DATERANGE entries */
    dateRanges: DateRange[];
    /** All parsed segments */
    segments: Segment[];
    /** Whether the playlist contains any ad markers */
    hasAds: boolean;
    /** Number of segments detected as ads */
    adSegmentCount: number;
    /** Total estimated ad duration in milliseconds */
    totalAdDurationMs: number;
    /** Playlist start time in microseconds (from first PROGRAM-DATE-TIME) */
    startTimeUs: number;
}

/**
 * Result of ad detection for a specific segment
 */
export interface AdDetectionResult {
    /** Whether the segment is an ad */
    isAd: boolean;
    /** The matching date range if ad was detected via DATERANGE */
    matchingDateRange?: DateRange;
    /** Reason for detection */
    reason: 'none' | 'segment_title' | 'daterange_id' | 'daterange_class' | 'daterange_attribute' | 'time_overlap';
    /** Estimated remaining ad time in milliseconds */
    remainingAdTimeMs?: number;
}

// ========== Parser Constants ==========

const EXTINF_REGEX = /^#EXTINF:([\d.]+)(?:,(.*))?$/;
const DATERANGE_REGEX = /^#EXT-X-DATERANGE:(.+)$/;
const TARGETDURATION_REGEX = /^#EXT-X-TARGETDURATION:(\d+)$/;
const MEDIASEQUENCE_REGEX = /^#EXT-X-MEDIA-SEQUENCE:(\d+)$/;
const PROGRAMDATETIME_REGEX = /^#EXT-X-PROGRAM-DATE-TIME:(.+)$/;

// ========== Utility Functions ==========

/**
 * Parse ISO date string to microseconds since Unix epoch
 */
function parseIsoDateToUs(isoDate: string): number {
    const timestamp = new Date(isoDate).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp * 1000;
}

/**
 * Parse attributes from a DATERANGE tag line
 * Handles quoted strings and unquoted values
 */
function parseDateRangeAttributes(attributeString: string): Record<string, string> {
    const attributes: Record<string, string> = {};

    // Match attribute patterns: KEY=VALUE or KEY="VALUE"
    // Handle both quoted and unquoted values
    const attrRegex = /([A-Z0-9_-]+)=(?:"([^"]*)"|([^,]+))/gi;
    let match;

    while ((match = attrRegex.exec(attributeString)) !== null) {
        const key = match[1];
        const value = match[2] !== undefined ? match[2] : match[3];
        attributes[key] = value;
    }

    return attributes;
}

/**
 * Check if a DateRange represents a Twitch ad based on its attributes
 */
function isDateRangeAd(attrs: Record<string, string>): boolean {
    // Check ID prefix
    if (attrs.ID?.startsWith(AD_DATERANGE_PATTERNS.idPrefix)) {
        return true;
    }

    // Check CLASS value
    if (attrs.CLASS === AD_DATERANGE_PATTERNS.classValue) {
        return true;
    }

    // Check for X-TV-TWITCH-AD-* attributes
    for (const key of Object.keys(attrs)) {
        if (key.startsWith(AD_DATERANGE_PATTERNS.attributePrefix)) {
            return true;
        }
    }

    return false;
}

// ========== Main Parser Functions ==========

/**
 * Parse a DateRange line into structured data
 */
function parseDateRange(line: string): DateRange | null {
    const match = line.match(DATERANGE_REGEX);
    if (!match) return null;

    const attrs = parseDateRangeAttributes(match[1]);

    if (!attrs.ID || !attrs['START-DATE']) {
        return null;
    }

    const startTimeUs = parseIsoDateToUs(attrs['START-DATE']);
    let endTimeUs: number | undefined;

    // Calculate end time from END-DATE, DURATION, or PLANNED-DURATION
    if (attrs['END-DATE']) {
        endTimeUs = parseIsoDateToUs(attrs['END-DATE']);
    } else if (attrs.DURATION) {
        const durationSec = parseFloat(attrs.DURATION);
        endTimeUs = startTimeUs + Math.round(durationSec * 1_000_000);
    } else if (attrs['PLANNED-DURATION']) {
        const plannedDurationSec = parseFloat(attrs['PLANNED-DURATION']);
        endTimeUs = startTimeUs + Math.round(plannedDurationSec * 1_000_000);
    }

    // Extract custom X-* attributes
    const customAttributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('X-')) {
            customAttributes[key] = value;
        }
    }

    return {
        id: attrs.ID,
        rangeClass: attrs.CLASS,
        startDate: attrs['START-DATE'],
        endDate: attrs['END-DATE'],
        duration: attrs.DURATION ? parseFloat(attrs.DURATION) : undefined,
        plannedDuration: attrs['PLANNED-DURATION'] ? parseFloat(attrs['PLANNED-DURATION']) : undefined,
        isAd: isDateRangeAd(attrs),
        customAttributes,
        startTimeUs,
        endTimeUs,
    };
}

/**
 * Check if a segment title contains ad network identifiers
 */
function isSegmentTitleAd(title: string): boolean {
    if (!title) return false;
    return AD_SEGMENT_PATTERNS.some(pattern => title.includes(pattern));
}

/**
 * Parse an M3U8 media playlist content to extract ad-related information
 *
 * @param content - The raw M3U8 manifest content
 * @returns Parsed MediaPlaylist with ad detection data
 */
export function parseMediaPlaylist(content: string): MediaPlaylist {
    const lines = content.split(/\r?\n/);

    let targetDuration = 0;
    let mediaSequence = 0;
    const dateRanges: DateRange[] = [];
    const segments: Segment[] = [];

    // Parse state
    let currentExtinf: { duration: number; title?: string } | null = null;
    let currentProgramDateTime: string | undefined;
    let cumulativeDurationUs = 0;
    let startTimeUs = 0;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Parse EXT-X-TARGETDURATION
        const targetMatch = trimmedLine.match(TARGETDURATION_REGEX);
        if (targetMatch) {
            targetDuration = parseInt(targetMatch[1], 10);
            continue;
        }

        // Parse EXT-X-MEDIA-SEQUENCE
        const seqMatch = trimmedLine.match(MEDIASEQUENCE_REGEX);
        if (seqMatch) {
            mediaSequence = parseInt(seqMatch[1], 10);
            continue;
        }

        // Parse EXT-X-PROGRAM-DATE-TIME
        const pdtMatch = trimmedLine.match(PROGRAMDATETIME_REGEX);
        if (pdtMatch) {
            currentProgramDateTime = pdtMatch[1];
            // Set playlist start time from first PDT
            if (startTimeUs === 0) {
                startTimeUs = parseIsoDateToUs(pdtMatch[1]);
            }
            continue;
        }

        // Parse EXT-X-DATERANGE
        if (trimmedLine.startsWith('#EXT-X-DATERANGE')) {
            const dateRange = parseDateRange(trimmedLine);
            if (dateRange) {
                dateRanges.push(dateRange);
            }
            continue;
        }

        // Parse EXTINF
        const extinfMatch = trimmedLine.match(EXTINF_REGEX);
        if (extinfMatch) {
            currentExtinf = {
                duration: parseFloat(extinfMatch[1]),
                title: extinfMatch[2] || undefined,
            };
            continue;
        }

        // Parse segment URI (non-comment line after EXTINF)
        if (!trimmedLine.startsWith('#') && currentExtinf) {
            const segment: Segment = {
                uri: trimmedLine,
                duration: currentExtinf.duration,
                title: currentExtinf.title,
                programDateTime: currentProgramDateTime,
                isAdByTitle: isSegmentTitleAd(currentExtinf.title || ''),
                relativeStartTimeUs: cumulativeDurationUs,
                sequenceNumber: mediaSequence + segments.length,
            };

            segments.push(segment);

            // Update cumulative duration (convert seconds to microseconds)
            cumulativeDurationUs += Math.round(currentExtinf.duration * 1_000_000);

            // Reset parse state for next segment
            currentExtinf = null;
            currentProgramDateTime = undefined;
        }
    }

    // Calculate ad statistics
    const adDateRanges = dateRanges.filter(dr => dr.isAd);
    const adSegmentsByTitle = segments.filter(seg => seg.isAdByTitle);

    let totalAdDurationMs = 0;

    // Sum durations from ad date ranges
    for (const dr of adDateRanges) {
        if (dr.duration) {
            totalAdDurationMs += dr.duration * 1000;
        } else if (dr.plannedDuration) {
            totalAdDurationMs += dr.plannedDuration * 1000;
        }
    }

    // If no date range duration, estimate from ad segments
    if (totalAdDurationMs === 0 && adSegmentsByTitle.length > 0) {
        totalAdDurationMs = adSegmentsByTitle.reduce(
            (sum, seg) => sum + seg.duration * 1000,
            0
        );
    }

    const hasAds = adDateRanges.length > 0 || adSegmentsByTitle.length > 0;

    return {
        targetDuration,
        mediaSequence,
        dateRanges,
        segments,
        hasAds,
        adSegmentCount: Math.max(adDateRanges.length, adSegmentsByTitle.length),
        totalAdDurationMs,
        startTimeUs,
    };
}

/**
 * Check if a segment is within an ad time range
 *
 * @param dateRanges - All date ranges from the playlist
 * @param segmentStartTimeUs - Segment start time in microseconds
 * @returns The matching ad DateRange if within an ad period
 */
export function findOverlappingAdRange(
    dateRanges: DateRange[],
    segmentStartTimeUs: number
): DateRange | null {
    for (const dr of dateRanges) {
        if (!dr.isAd || !dr.endTimeUs) continue;

        // Check if segment starts within this ad range
        if (segmentStartTimeUs >= dr.startTimeUs && segmentStartTimeUs < dr.endTimeUs) {
            return dr;
        }
    }
    return null;
}

/**
 * Detect if a segment is an ad based on all available information
 *
 * @param segment - The segment to check
 * @param playlist - The parsed playlist containing date ranges
 * @returns Detection result with reason
 */
export function detectAdSegment(
    segment: Segment,
    playlist: MediaPlaylist
): AdDetectionResult {
    // 1. Check segment title for ad network identifiers
    if (segment.isAdByTitle) {
        return {
            isAd: true,
            reason: 'segment_title',
        };
    }

    // 2. Check if segment falls within an ad date range (time-based)
    // Skip time-based detection if playlist lacks PROGRAM-DATE-TIME (startTimeUs would be 0)
    // In this case, we can't reliably compare relative offsets against absolute DateRange timestamps
    if (playlist.startTimeUs === 0) {
        if (playlist.dateRanges.some(dr => dr.isAd)) {
            console.warn(
                '[HLS Parser] Playlist has ad DateRanges but no PROGRAM-DATE-TIME. ' +
                'Time-based ad detection skipped; relying on segment title detection only.'
            );
        }
        return {
            isAd: false,
            reason: 'none',
        };
    }

    // 3. Calculate absolute segment time
    const segmentAbsoluteTimeUs = playlist.startTimeUs + segment.relativeStartTimeUs;

    // 4. Check if segment falls within an ad date range
    const matchingRange = findOverlappingAdRange(playlist.dateRanges, segmentAbsoluteTimeUs);

    if (matchingRange) {
        // Calculate remaining ad time
        let remainingAdTimeMs: number | undefined;
        if (matchingRange.endTimeUs) {
            const remainingUs = matchingRange.endTimeUs - segmentAbsoluteTimeUs;
            remainingAdTimeMs = Math.max(0, Math.round(remainingUs / 1000));
        }

        // Determine specific reason
        let reason: AdDetectionResult['reason'] = 'time_overlap';
        if (matchingRange.id.startsWith(AD_DATERANGE_PATTERNS.idPrefix)) {
            reason = 'daterange_id';
        } else if (matchingRange.rangeClass === AD_DATERANGE_PATTERNS.classValue) {
            reason = 'daterange_class';
        } else if (Object.keys(matchingRange.customAttributes).some(k => k.startsWith(AD_DATERANGE_PATTERNS.attributePrefix))) {
            reason = 'daterange_attribute';
        }

        return {
            isAd: true,
            matchingDateRange: matchingRange,
            reason,
            remainingAdTimeMs,
        };
    }

    return {
        isAd: false,
        reason: 'none',
    };
}

/**
 * Quick check if manifest text contains any ad markers
 * Faster than full parse when you just need to know if ads exist
 *
 * @param manifestText - Raw M3U8 content
 * @returns true if any ad markers are detected
 */
export function hasAdMarkers(manifestText: string): boolean {
    // Check for EXT-X-DATERANGE with ad patterns
    if (manifestText.includes(`ID="${AD_DATERANGE_PATTERNS.idPrefix}`)) {
        return true;
    }
    if (manifestText.includes(`CLASS="${AD_DATERANGE_PATTERNS.classValue}"`)) {
        return true;
    }
    if (manifestText.includes(AD_DATERANGE_PATTERNS.attributePrefix)) {
        return true;
    }

    // Check for segment titles with ad patterns
    for (const pattern of AD_SEGMENT_PATTERNS) {
        if (manifestText.includes(pattern)) {
            return true;
        }
    }

    return false;
}

/**
 * Get the current ad state based on the last segment in the playlist
 *
 * @param playlist - Parsed media playlist
 * @returns Ad detection result for the last segment (most recent)
 */
export function getCurrentAdState(playlist: MediaPlaylist): AdDetectionResult {
    if (playlist.segments.length === 0) {
        return { isAd: false, reason: 'none' };
    }

    const lastSegment = playlist.segments[playlist.segments.length - 1];
    return detectAdSegment(lastSegment, playlist);
}

/**
 * Extract advertiser name from a date range if available
 *
 * @param dateRange - The date range to check
 * @returns Advertiser name or undefined
 */
export function getAdvertiserFromDateRange(dateRange: DateRange): string | undefined {
    // Check X-TV-TWITCH-AD-ADVERTISER attribute
    return dateRange.customAttributes['X-TV-TWITCH-AD-ADVERTISER'];
}

// ========== VAFT Phase 1: Resolution Matching & Prefetch Stripping ==========

import {
    parseM3U8Attributes,
    type ResolutionInfo,
    type TargetResolution,
} from '@/shared/adblock-types';

/**
 * Parse a master M3U8 playlist and extract all variant streams with their resolutions.
 * 
 * @param masterM3u8 - The raw master playlist content
 * @returns Array of ResolutionInfo for each variant
 */
export function parseVariantStreams(masterM3u8: string): ResolutionInfo[] {
    const lines = masterM3u8.replace(/\r/g, '').split('\n');
    const variants: ResolutionInfo[] = [];

    for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF') && !lines[i + 1].startsWith('#')) {
            const attrs = parseM3U8Attributes(lines[i]);
            const resolution = attrs['RESOLUTION'] as string | undefined;
            const frameRate = attrs['FRAME-RATE'] as number | undefined;
            const codecs = attrs['CODECS'] as string | undefined;
            const bandwidth = attrs['BANDWIDTH'] as number | undefined;

            if (resolution) {
                const [width, height] = resolution.split('x').map(Number);
                if (!isNaN(width) && !isNaN(height)) {
                    variants.push({
                        resolution,
                        width,
                        height,
                        frameRate: frameRate ?? 30, // Default to 30fps if not specified
                        codecs,
                        bandwidth,
                        url: lines[i + 1].trim(),
                    });
                }
            }
        }
    }

    return variants;
}

/**
 * Find the best matching variant URL for a target resolution.
 * Based on VAFT getStreamUrlForResolution (lines 431-461).
 * 
 * Algorithm:
 * 1. First, try to find an exact resolution match
 * 2. If exact match found, prefer one with matching frame rate
 * 3. If no exact match, find the closest resolution by pixel count
 * 
 * @param masterM3u8 - The raw master playlist content
 * @param targetResolution - The desired resolution to match
 * @returns The best matching variant URL, or null if none found
 */
export function getStreamUrlForResolution(
    masterM3u8: string,
    targetResolution: TargetResolution
): string | null {
    const variants = parseVariantStreams(masterM3u8);

    if (variants.length === 0) {
        console.warn('[HLS Parser] No variants found in master playlist');
        return null;
    }

    const targetPixels = targetResolution.width * targetResolution.height;
    let matchedVariant: ResolutionInfo | null = null;
    let matchedFrameRate = false;
    let closestVariant: ResolutionInfo | null = null;
    let closestDiff = Infinity;

    for (const variant of variants) {
        const candidatePixels = variant.width * variant.height;
        const diff = Math.abs(candidatePixels - targetPixels);

        // Check for exact resolution match
        if (variant.width === targetResolution.width && variant.height === targetResolution.height) {
            // Found exact resolution match
            const frameRateMatches = targetResolution.frameRate !== undefined &&
                variant.frameRate === targetResolution.frameRate;

            if (!matchedVariant || (!matchedFrameRate && frameRateMatches)) {
                matchedVariant = variant;
                matchedFrameRate = frameRateMatches;

                // If both resolution and frame rate match, we're done
                if (matchedFrameRate) {
                    console.log(`[HLS Parser] Exact match found: ${variant.resolution}@${variant.frameRate}fps`);
                    return matchedVariant.url;
                }
            }
        }

        // Track closest resolution by pixel count
        if (diff < closestDiff) {
            closestVariant = variant;
            closestDiff = diff;
        }
    }

    // Return exact match (without frame rate match) if found
    if (matchedVariant) {
        console.log(`[HLS Parser] Resolution match found: ${matchedVariant.resolution}@${matchedVariant.frameRate}fps`);
        return matchedVariant.url;
    }

    // Return closest resolution
    if (closestVariant) {
        console.log(`[HLS Parser] Closest match found: ${closestVariant.resolution}@${closestVariant.frameRate}fps ` +
            `(target was ${targetResolution.width}x${targetResolution.height})`);
        return closestVariant.url;
    }

    return null;
}

/**
 * Strip #EXT-X-TWITCH-PREFETCH: tags from M3U8 content.
 * This prevents HLS.js from prefetching ad segments before we detect them.
 * Based on VAFT stripAdSegments (lines 414-419).
 * 
 * @param m3u8Content - The raw M3U8 manifest content
 * @returns The content with prefetch tags removed
 */
export function stripPrefetchTags(m3u8Content: string): string {
    const lines = m3u8Content.replace(/\r/g, '').split('\n');
    return lines
        .filter(line => !line.startsWith('#EXT-X-TWITCH-PREFETCH:'))
        .join('\n');
}

/**
 * Process an M3U8 manifest for ad blocking.
 * Strips prefetch tags when ads are detected.
 * 
 * @param m3u8Content - The raw M3U8 manifest content
 * @param hasAds - Whether ads have been detected in the stream
 * @returns Object containing processed content and whether prefetch was stripped
 */
export function processM3U8ForAds(
    m3u8Content: string,
    hasAds: boolean
): { content: string; strippedPrefetch: boolean } {
    if (!hasAds) {
        return { content: m3u8Content, strippedPrefetch: false };
    }

    const processed = stripPrefetchTags(m3u8Content);
    const strippedCount = m3u8Content.split('#EXT-X-TWITCH-PREFETCH:').length - 1;

    if (strippedCount > 0) {
        console.log(`[HLS Parser] Stripped ${strippedCount} prefetch tag(s) during ad blocking`);
    }

    return {
        content: processed,
        strippedPrefetch: processed !== m3u8Content
    };
}

/**
 * Parse resolution string from a quality string like "1080p60" or "720p".
 * 
 * @param qualityString - Quality string (e.g., "1080p60", "720p30", "480p")
 * @returns TargetResolution object or null if parsing fails
 */
export function parseResolutionString(qualityString: string): TargetResolution | null {
    // Match patterns like "1080p60", "720p30", "480p"
    const match = qualityString.match(/^(\d+)p(\d+)?$/);

    if (!match) {
        return null;
    }

    const height = parseInt(match[1], 10);
    const frameRate = match[2] ? parseInt(match[2], 10) : undefined;

    // Calculate width based on 16:9 aspect ratio
    const width = Math.round(height * (16 / 9));

    return {
        width,
        height,
        frameRate,
    };
}

