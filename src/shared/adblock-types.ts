/**
 * Native Ad-Block Configuration Types (VAFT Implementation)
 *
 * Implements TwitchAdSolutions VAFT-style ad-blocking for Twitch streams.
 * Based on https://github.com/pixeltris/TwitchAdSolutions
 *
 * Core Strategy (hardcoded - no user configuration needed):
 * 1. Force 'site' playerType to reduce prerolls
 * 2. Always use 'web' platform (source quality)
 * 3. Random X-Device-Id for each request
 * 4. Backup playerTypes: embed → site → autoplay → picture-by-picture
 * 5. 'stitched' keyword detection in M3U8
 * 6. ',live' segment suffix detection
 */

// ========== VAFT Constants (from TwitchAdSolutions) ==========

/**
 * The primary indicator that a segment is an ad.
 * Live content has ',live' suffix in #EXTINF, ads don't.
 * Also 'stitched' appears in EXT-X-DATERANGE IDs for ads.
 */
export const VAFT_AD_SIGNIFIER = 'stitched';

/**
 * Twitch's public Client ID used for GQL requests.
 * This is public information from the Twitch web player.
 */
export const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

/**
 * Backup player types to try when ads are detected.
 * Order matters - try source quality first, then lower quality options.
 * 
 * From VAFT script lines 26-31:
 * - embed: Source quality, often ad-free
 * - site: Source quality, standard player
 * - autoplay: 360p but frequently ad-free (uses platform: 'android')
 * - picture-by-picture: 360p, often ad-free
 */
export const VAFT_BACKUP_PLAYER_TYPES = [
    { playerType: 'embed', platform: 'web' },
    { playerType: 'site', platform: 'web' },
    { playerType: 'autoplay', platform: 'android' },  // Mobile = less ads
    { playerType: 'picture-by-picture', platform: 'web' },
] as const;

/**
 * Default fallback player type when all backup strategies fail.
 */
export const VAFT_FALLBACK_PLAYER_TYPE = 'embed';

/**
 * Force this playerType for the initial access token request.
 * 'site' reduces prerolls compared to 'embed' on embedded websites.
 */
export const VAFT_FORCE_ACCESS_TOKEN_PLAYER_TYPE = 'site';

// ========== Player Type Definitions ==========

export type PlayerType =
    | 'site'
    | 'embed'
    | 'channel_home_live'
    | 'frontpage'
    | 'picture-by-picture'
    | 'autoplay'
    | 'thunderdome';

export type TwitchPlatform = 'web' | 'ios' | 'android';

/**
 * Fallback X-Device-Id value when random device ID fails.
 * Random is always preferred for ad-blocking.
 */
export const FALLBACK_DEVICE_ID = 'twitch-web-wall-mason';

/**
 * Supported video codecs sent to Twitch.
 */
export const DEFAULT_SUPPORTED_CODECS = 'h265,h264';

// ========== Ad-Block Configuration (Simplified) ==========

/**
 * Simplified ad-block config - just enabled/disabled.
 * All strategies are hardcoded based on VAFT script.
 */
export interface AdBlockConfig {
    /** Whether native ad-block is enabled */
    enabled: boolean;
}

/**
 * Internal configuration passed to the stream resolver.
 * Built automatically from AdBlockConfig.
 */
export interface TwitchAdBlockConfig {
    enabled: boolean;
    /** Always true for VAFT style */
    useRandomDeviceId: boolean;
    /** Fallback device ID (rarely used) */
    fallbackDeviceId: string;
    /** Player type - set by VAFT logic */
    playerType: string;
    /** Platform - 'web' for source quality */
    platform: string;
    /** Supported video codecs */
    supportedCodecs: string;
    /** Whether this is a VOD request */
    isVod?: boolean;
}

/**
 * Creates the internal ad-block config from user's simple enabled/disabled setting.
 */
export function createTwitchAdBlockConfig(enabled: boolean, isVod: boolean = false): TwitchAdBlockConfig {
    return {
        enabled,
        useRandomDeviceId: true, // Always use random for best ad-blocking
        fallbackDeviceId: FALLBACK_DEVICE_ID,
        playerType: VAFT_FORCE_ACCESS_TOKEN_PLAYER_TYPE, // 'site' to reduce prerolls
        platform: 'web', // Always web for source quality
        supportedCodecs: DEFAULT_SUPPORTED_CODECS,
        isVod,
    };
}

export const DEFAULT_ADBLOCK_CONFIG: AdBlockConfig = {
    enabled: false, // Opt-in by default
};

// ========== Ad Detection Patterns (from VAFT script) ==========

/**
 * The primary ad detection: check for 'stitched' keyword.
 * From VAFT line 24 and processM3U8 line 471.
 */
export function hasStitchedAds(manifestText: string): boolean {
    return manifestText.includes(VAFT_AD_SIGNIFIER);
}

/**
 * Check if a segment is live content (not an ad).
 * Live segments end with ',live' in #EXTINF tag.
 * Ads don't have this suffix.
 * 
 * From VAFT stripAdSegments line 401:
 * if (line.startsWith('#EXTINF') && !line.includes(',live'))
 */
export function isLiveSegment(extinfLine: string): boolean {
    return extinfLine.includes(',live');
}

/**
 * Check if an EXTINF line is an ad segment.
 * Ad segments don't have ',live' suffix.
 */
export function isAdSegment(extinfLine: string): boolean {
    return extinfLine.startsWith('#EXTINF') && !extinfLine.includes(',live');
}

/**
 * Patterns found in HLS segment titles that indicate an ad.
 */
export const AD_SEGMENT_PATTERNS = [
    'Amazon',
    'Adform',
    'DCM',
];

/**
 * Patterns found in HLS #EXT-X-DATERANGE tags that indicate an ad.
 */
export const AD_DATERANGE_PATTERNS = {
    /** ID prefix for stitched ad entries */
    idPrefix: 'stitched-ad-',
    /** Class value for Twitch stitched ads */
    classValue: 'twitch-stitched-ad',
    /** Attribute prefix for Twitch ad metadata */
    attributePrefix: 'X-TV-TWITCH-AD-',
};

// ========== Ad Info Types ==========

/**
 * Information about a detected ad
 */
export interface AdInfo {
    /** Whether an ad is currently playing */
    isAd: boolean;
    /** Unique identifier for the ad */
    adId?: string;
    /** Duration of the ad in seconds */
    adDuration?: number;
    /** Remaining time in milliseconds */
    adRemainingMs?: number;
    /** Whether this is a midroll (vs preroll) */
    isMidroll?: boolean;
}

// ========== Resolution Matching Types (VAFT Phase 1) ==========

/**
 * Information about a stream resolution/variant.
 * Used for resolution-matched backup selection.
 * Based on VAFT getStreamUrlForResolution (lines 431-461)
 */
export interface ResolutionInfo {
    /** Resolution string, e.g., "1920x1080" */
    resolution: string;
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
    /** Frame rate, e.g., 60 */
    frameRate: number;
    /** Video codecs, e.g., "avc1.4D401F" */
    codecs?: string;
    /** Bandwidth in bits/second */
    bandwidth?: number;
    /** Variant playlist URL */
    url: string;
}

/**
 * Target resolution for backup stream matching.
 */
export interface TargetResolution {
    /** Target width in pixels */
    width: number;
    /** Target height in pixels */
    height: number;
    /** Target frame rate (optional) */
    frameRate?: number;
}

// ========== Utility Functions ==========

/**
 * Generate a random 32-character device ID.
 * Matches VAFT's implementation.
 */
export function generateRandomDeviceId(): string {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 32);
}

/**
 * Generate a random GQL Device ID if not provided.
 * From VAFT lines 654-659.
 */
export function generateGQLDeviceId(): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * Detect ads in an HLS manifest (comprehensive check).
 * Combines multiple detection methods from VAFT.
 */
export function detectAdInManifest(manifestText: string): boolean {
    // Primary check: 'stitched' keyword
    if (hasStitchedAds(manifestText)) {
        return true;
    }

    const lines = manifestText.split('\n');

    for (const line of lines) {
        // Check EXTINF for non-live segments (ads)
        if (line.startsWith('#EXTINF') && !line.includes(',live')) {
            return true;
        }

        // Check EXT-X-DATERANGE for ad markers
        if (line.startsWith('#EXT-X-DATERANGE')) {
            if (line.includes(`ID="${AD_DATERANGE_PATTERNS.idPrefix}`)) {
                return true;
            }
            if (line.includes(`CLASS="${AD_DATERANGE_PATTERNS.classValue}"`)) {
                return true;
            }
            if (line.includes('CLASS="com.apple.hls.interstitial"')) {
                return true;
            }
            if (line.includes(AD_DATERANGE_PATTERNS.attributePrefix)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Detect ads in a segment title by checking for ad network identifiers.
 */
export function detectAdInSegment(title: string): boolean {
    return AD_SEGMENT_PATTERNS.some(pattern => title.includes(pattern));
}

/**
 * Check if a manifest indicates midroll ads.
 * From VAFT line 473.
 */
export function isMidrollAd(manifestText: string): boolean {
    return manifestText.includes('"MIDROLL"') || manifestText.includes('"midroll"');
}

/**
 * Parse M3U8 attributes string into key-value object.
 * From VAFT parseAttributes lines 621-632.
 */
export function parseM3U8Attributes(str: string): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    const regex = /(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/g;
    let match;

    while ((match = regex.exec(str)) !== null) {
        const part = match[1];
        const idx = part.indexOf('=');
        if (idx > -1) {
            const key = part.substring(0, idx);
            let value: string = part.substring(idx + 1);
            // Remove quotes if present
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            // Try to parse as number
            const num = Number(value);
            result[key] = Number.isNaN(num) ? value : num;
        }
    }
    return result;
}

// ========== Legacy exports for backward compatibility ==========

export const PLAYER_TYPE_INFO: Record<PlayerType, {
    label: string;
    description: string;
    adBehavior: 'normal' | 'reduced' | 'sometimes_none' | 'different';
}> = {
    'site': {
        label: 'Default (Site)',
        description: 'Standard web player',
        adBehavior: 'normal',
    },
    'embed': {
        label: 'Embedded',
        description: 'Embedded player mode',
        adBehavior: 'reduced',
    },
    'channel_home_live': {
        label: 'Channel Home',
        description: 'Channel page player',
        adBehavior: 'reduced',
    },
    'frontpage': {
        label: 'Frontpage',
        description: 'Homepage player',
        adBehavior: 'reduced',
    },
    'picture-by-picture': {
        label: 'Picture-by-Picture',
        description: 'PiP mode player',
        adBehavior: 'sometimes_none',
    },
    'autoplay': {
        label: 'Autoplay',
        description: '360p mobile player',
        adBehavior: 'sometimes_none',
    },
    'thunderdome': {
        label: 'Thunderdome',
        description: 'Internal player mode',
        adBehavior: 'reduced',
    },
};

export const PLATFORM_INFO: Record<TwitchPlatform, {
    label: string;
    description: string;
}> = {
    'web': {
        label: 'Web',
        description: 'Web browser platform',
    },
    'ios': {
        label: 'iOS',
        description: 'iOS mobile platform',
    },
    'android': {
        label: 'Android',
        description: 'Android mobile platform',
    },
};
