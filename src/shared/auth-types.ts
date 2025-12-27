/**
 * Authentication Type Definitions
 *
 * Shared type definitions for authentication across main and renderer processes.
 */

import { StreamProxyConfig, DEFAULT_STREAM_PROXY_CONFIG } from './proxy-types';
import { AdBlockConfig, DEFAULT_ADBLOCK_CONFIG } from './adblock-types';
// ========== Platform Types ==========

export type Platform = 'twitch' | 'kick';

// ========== Token Types ==========

export interface AuthToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number; // Unix timestamp in milliseconds
    scope?: string[];
}

export interface EncryptedToken {
    encrypted: string; // Base64 encoded encrypted token
    iv?: string; // Initialization vector if needed
}

// ========== User Types ==========

export interface TwitchUser {
    id: string;
    login: string;
    displayName: string;
    profileImageUrl: string;
    email?: string;
    createdAt: string;
    broadcasterType: 'partner' | 'affiliate' | '';
}

export interface KickUser {
    id: number;
    username: string;
    slug: string;
    profilePic: string;
    email?: string;
    bio?: string;
    verified: boolean;
    twitter?: string;
    discord?: string;
    instagram?: string;
    tiktok?: string;
    facebook?: string;
    youtube?: string;
}

export type PlatformUser = TwitchUser | KickUser;

// ========== Follow Types ==========

export interface LocalFollow {
    id: string; // Unique identifier (generated)
    platform: Platform;
    channelId: string;
    channelName: string; // Username/login
    displayName: string;
    profileImage: string;
    followedAt: string; // ISO date string
    lastSeen?: string; // ISO date string
    isLive?: boolean;
    notifications?: boolean;
}

export interface TwitchFollow {
    userId: string;
    userLogin: string;
    userName: string;
    followedAt: string;
}

export interface KickFollow {
    channelId: number;
    slug: string;
    username: string;
    followedAt: string;
}

// ========== Preferences Types ==========

export type Theme = 'light' | 'dark' | 'system';
export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p' | '160p';
export type ChatPosition = 'right' | 'left' | 'hidden';
export type ChatSize = 'small' | 'medium' | 'large';

export interface NotificationPreferences {
    enabled: boolean;
    liveAlerts: boolean;
    sound: boolean;
    favoriteChannelsOnly: boolean;
}

export interface ChatPreferences {
    position: ChatPosition;
    size: ChatSize;
    timestamps: boolean;
    badges: boolean;
    emotes: boolean;
    fontScale: number; // 0.8 - 1.5
}

export interface PlaybackPreferences {
    autoPlay: boolean;
    defaultQuality: VideoQuality;
    lowLatency: boolean;
    theaterMode: boolean;
    volume: number; // 0-1
    muted: boolean;
}

/**
 * Ad-block preferences for Twitch streams.
 * Uses VAFT-style ad-blocking with hardcoded optimal strategies.
 */
export interface AdBlockPreferences {
    /** Enable native ad-blocking (mutually exclusive with streamProxy) */
    enabled: boolean;

    /** Hide video and mute when ads are detected (fallback protection) */
    hideAdsDuringPlayback: boolean;

    /**
     * Show blocking status overlay in top-left corner.
     * e.g., "Blocking midroll ads"
     * @default true
     */
    showStatusOverlay: boolean;
}

/**
 * Buffering recovery preferences for stream stability.
 * Phase 3 VAFT feature: Automatic detection and recovery of stuck playback.
 */
export interface BufferingRecoveryPreferences {
    /** Enable automatic buffering recovery. Default: true */
    enabled: boolean;

    /**
     * Detection sensitivity preset.
     * - 'low': Very conservative (5 stuck checks, 0.5s danger zone, 10s cooldown)
     * - 'medium': Balanced (3 stuck checks, 1s danger zone, 5s cooldown) - DEFAULT
     * - 'high': Aggressive (2 stuck checks, 2s danger zone, 3s cooldown)
     */
    sensitivity: 'low' | 'medium' | 'high';

    /** Show a subtle notification when recovery triggers. Default: false */
    showNotification: boolean;
}

/**
 * Sensitivity preset configurations for buffering recovery.
 */
export const BUFFERING_RECOVERY_PRESETS = {
    low: {
        checkIntervalMs: 500,
        sameStateThreshold: 5,
        dangerZoneSeconds: 0.5,
        minRepeatDelayMs: 10000,
    },
    medium: {
        checkIntervalMs: 500,
        sameStateThreshold: 3,
        dangerZoneSeconds: 1,
        minRepeatDelayMs: 5000,
    },
    high: {
        checkIntervalMs: 500,
        sameStateThreshold: 2,
        dangerZoneSeconds: 2,
        minRepeatDelayMs: 3000,
    },
} as const;

/**
 * Enhanced Features preferences (Phase 4 VAFT).
 * Advanced ad-blocking and playback optimization features.
 */
export interface EnhancedFeaturesPreferences {
    /**
     * Enable visibility state spoofing for background playback.
     * Prevents the player from pausing when window loses focus.
     * Useful for PiP and multi-monitor setups.
     *
     * Based on VAFT lines 971-1027.
     * @default false
     */
    visibilitySpoofing: boolean;

    /**
     * Force AVC codec over HEVC for better compatibility.
     * Some browsers (especially Chrome) may not fully support HEVC playback.
     * When enabled, the app will prefer AVC variants over HEVC for 2K/4K streams.
     *
     * Based on VAFT lines 329-355.
     * @default false (auto-detect)
     */
    forceAvcCodec: boolean;

    /**
     * Use ad segment stripping for additional ad blocking.
     * Replaces ad segments in the playlist with a placeholder video.
     * This is more aggressive than just hiding the player during ads.
     *
     * Based on VAFT lines 391-430.
     * @default false (experimental)
     */
    adSegmentStripping: boolean;

    /**
     * Ad segment stripping mode.
     * - 'placeholder': Replace ad segments with a black/silent video
     * - 'skip': Remove ad segments entirely (may cause timing issues)
     *
     * @default 'placeholder'
     */
    adStrippingMode: 'placeholder' | 'skip';
}

export const DEFAULT_ENHANCED_FEATURES_PREFERENCES: EnhancedFeaturesPreferences = {
    visibilitySpoofing: false,
    forceAvcCodec: false,
    adSegmentStripping: false,
    adStrippingMode: 'placeholder',
};

/**
 * Advanced/Developer preferences.
 * These settings control behavior that may have security or compliance implications.
 */
export interface AdvancedPreferences {
    /**
     * Enable image proxy for blocked CDN images (e.g., Kick offline banners).
     * 
     * When enabled, the app will spoof request headers (Referer, User-Agent) to
     * bypass hotlinking restrictions on certain CDNs. This is necessary because:
     * - Kick CDN (files.kick.com) returns 403 Forbidden without proper Referer header
     * - Desktop apps cannot set Referer headers from the renderer process
     * 
     * ⚠️ SECURITY/COMPLIANCE NOTES:
     * - This modifies Sec-Fetch-* and Referer headers, which may violate the
     *   platform's terms of service
     * - Kick has an official API (https://docs.kick.com) but does not provide
     *   a documented method for CDN image access without authentication
     * - Users should review Kick's ToS before enabling this feature
     * 
     * @default true (enabled for better UX, but can be disabled)
     */
    enableImageProxy: boolean;

    /**
     * Stream proxy configuration for ad blocking (Twitch only).
     * Routes HLS manifest requests through external servers to bypass ads.
     *
     * Based on the Twire Android app implementation.
     * @see https://github.com/twireapp/Twire
     *
     * ⚠️ MUTUAL EXCLUSIVITY: If adBlock.enabled is true, streamProxy is ignored.
     *
     * @default { selectedProxy: 'none', fallbackToDirect: true }
     */
    streamProxy: StreamProxyConfig;

    /**
     * Native ad-block configuration for Twitch streams.
     * Uses token manipulation and device ID randomization to reduce ads.
     *
     * ⚠️ MUTUAL EXCLUSIVITY: When enabled, streamProxy is automatically disabled.
     *
     * @default { enabled: false, useRandomDeviceId: true, livePlayerType: 'embed', ... }
     */
    adBlock: AdBlockPreferences;

    /**
     * Buffering recovery configuration for stream stability.
     * Automatically detects and recovers stuck playback.
     *
     * @default { enabled: true, recoveryMethod: 'pause-play', sensitivity: 'medium', showNotification: false }
     */
    bufferingRecovery: BufferingRecoveryPreferences;

    /**
     * Enhanced features configuration (Phase 4 VAFT).
     * Advanced ad-blocking and playback optimization features.
     *
     * @default { visibilitySpoofing: false, forceAvcCodec: false, adSegmentStripping: false }
     */
    enhancedFeatures: EnhancedFeaturesPreferences;
}

export interface UserPreferences {
    theme: Theme;
    language: string;
    notifications: NotificationPreferences;
    chat: ChatPreferences;
    playback: PlaybackPreferences;
    advanced: AdvancedPreferences;
    startMinimized: boolean;
    minimizeToTray: boolean;
}

// ========== Storage Schema ==========

export interface StorageSchema {
    // Auth tokens (encrypted)
    authTokens: {
        twitch?: EncryptedToken;
        kick?: EncryptedToken;
    };

    // App tokens (encrypted, for client credentials flow)
    appTokens?: {
        twitch?: EncryptedToken;
        kick?: EncryptedToken;
    };

    // User data
    twitchUser: TwitchUser | null;
    kickUser: KickUser | null;

    // Local follows (for guest mode)
    localFollows: LocalFollow[];

    // User preferences
    preferences: UserPreferences;

    // App state
    lastActiveTab: string;
    windowBounds: {
        x?: number;
        y?: number;
        width: number;
        height: number;
        isMaximized: boolean;
    };
}

// ========== Auth Result Types ==========

export interface AuthResult {
    success: boolean;
    platform: Platform;
    user?: PlatformUser;
    error?: AuthError;
}

export type AuthErrorCode =
    | 'NETWORK_ERROR'
    | 'INVALID_TOKEN'
    | 'TOKEN_EXPIRED'
    | 'USER_CANCELLED'
    | 'PERMISSION_DENIED'
    | 'UNKNOWN_ERROR';

export interface AuthError {
    code: AuthErrorCode;
    message: string;
    platform: Platform;
}

// ========== Default Values ==========

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    enabled: true,
    liveAlerts: true,
    sound: true,
    favoriteChannelsOnly: false,
};

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
    position: 'right',
    size: 'medium',
    timestamps: false,
    badges: true,
    emotes: true,
    fontScale: 1,
};

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
    autoPlay: true,
    defaultQuality: 'auto',
    lowLatency: true,
    theaterMode: false,
    volume: 0.8,
    muted: false,
};

export const DEFAULT_ADBLOCK_PREFERENCES: AdBlockPreferences = {
    enabled: false, // Disabled by default (user must opt-in)
    hideAdsDuringPlayback: true, // Always mute/hide when ads leak through
    showStatusOverlay: true, // Show status by default
};

export const DEFAULT_BUFFERING_RECOVERY_PREFERENCES: BufferingRecoveryPreferences = {
    enabled: true, // Enabled by default for better UX
    sensitivity: 'medium', // Balanced default
    showNotification: false, // Don't spam user
};

export const DEFAULT_ADVANCED_PREFERENCES: AdvancedPreferences = {
    enableImageProxy: true, // Enabled by default for better UX
    streamProxy: DEFAULT_STREAM_PROXY_CONFIG, // Disabled by default, user must opt-in
    adBlock: DEFAULT_ADBLOCK_PREFERENCES, // Disabled by default, user must opt-in
    bufferingRecovery: DEFAULT_BUFFERING_RECOVERY_PREFERENCES, // Enabled by default
    enhancedFeatures: DEFAULT_ENHANCED_FEATURES_PREFERENCES, // Disabled by default (experimental)
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
    theme: 'dark',
    language: 'en',
    notifications: DEFAULT_NOTIFICATION_PREFERENCES,
    chat: DEFAULT_CHAT_PREFERENCES,
    playback: DEFAULT_PLAYBACK_PREFERENCES,
    advanced: DEFAULT_ADVANCED_PREFERENCES,
    startMinimized: false,
    minimizeToTray: true,
};

export const DEFAULT_WINDOW_BOUNDS = {
    width: 1280,
    height: 720,
    isMaximized: false,
};
