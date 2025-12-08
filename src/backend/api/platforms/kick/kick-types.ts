/**
 * Kick API Types
 *
 * Type definitions for Kick API responses.
 * These are the raw types from the API before transformation to unified types.
 */

// ========== Kick User ==========

export interface KickApiUser {
    id: number;
    username: string;
    agreed_to_terms: boolean;
    email_verified_at: string | null;
    bio: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
    discord: string | null;
    tiktok: string | null;
    facebook: string | null;
    profile_pic: string | null;
}

// ========== Kick Channel ==========

export interface KickApiChannel {
    id: number;
    user_id: number;
    slug: string;
    is_banned: boolean;
    playback_url: string | null;
    vod_enabled: boolean;
    subscription_enabled: boolean;
    followers_count: number;
    subscriber_badges: KickSubscriberBadge[];
    banner_image: KickImage | null;
    recent_categories: KickApiCategory[];
    livestream: KickApiLivestream | null;
    role: string | null;
    muted: boolean;
    follower_badges: any[];
    offline_banner_image: KickImage | null;
    verified: boolean;
    can_host: boolean;
    user: KickApiChannelUser;
}

export interface KickApiChannelUser {
    id: number;
    username: string;
    agreed_to_terms: boolean;
    email_verified_at: string | null;
    bio: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
    discord: string | null;
    tiktok: string | null;
    facebook: string | null;
    profile_pic: string | null;
}

export interface KickSubscriberBadge {
    id: number;
    channel_id: number;
    months: number;
    badge_image: KickImage;
}

export interface KickImage {
    src: string;
    srcset?: string;
}

// ========== Kick Livestream ==========

export interface KickApiLivestream {
    id: number;
    slug: string;
    channel_id: number;
    created_at: string;
    session_title: string;
    is_live: boolean;
    risk_level_id: number | null;
    start_time: string;
    source: string | null;
    twitch_channel: string | null;
    duration: number;
    language: string;
    is_mature: boolean;
    viewer_count: number;
    thumbnail: KickImage | null;
    categories: KickApiCategory[];
    tags: string[];
}

// ========== Kick Category ==========

export interface KickApiCategory {
    id: number;
    category_id: number;
    name: string;
    slug: string;
    tags: string[];
    description: string | null;
    deleted_at: string | null;
    viewers: number;
    banner: KickImage | null;
    category: {
        id: number;
        name: string;
        slug: string;
        icon: string;
    };
}

// ========== Kick Video/VOD ==========

export interface KickApiVideo {
    id: number;
    live_stream_id: number;
    slug: string | null;
    thumb: string | null;
    s3: string | null;
    trading_platform_id: number | null;
    created_at: string;
    updated_at: string;
    uuid: string;
    views: number;
    deleted_at: string | null;
    source: string;
    livestream: {
        id: number;
        slug: string;
        channel_id: number;
        created_at: string;
        session_title: string;
        is_live: boolean;
        risk_level_id: number | null;
        start_time: string;
        source: string | null;
        twitch_channel: string | null;
        duration: number;
        language: string;
        is_mature: boolean;
        viewer_count: number;
        thumbnail: KickImage | null;
        channel: {
            id: number;
            user_id: number;
            slug: string;
            user: {
                id: number;
                username: string;
                profile_pic: string | null;
            };
        };
        categories: KickApiCategory[];
    };
}

// ========== Kick Clip ==========

export interface KickApiClip {
    id: string;
    livestream_id: string;
    category_id: string;
    channel_id: number;
    user_id: number;
    title: string;
    clip_url: string;
    thumbnail_url: string;
    privacy: string;
    likes: number;
    liked: boolean;
    views: number;
    duration: number;
    started_at: string;
    created_at: string;
    is_mature: boolean;
    video_url: string;
    view_count: number;
    likes_count: number;
    channel: {
        id: number;
        username: string;
        slug: string;
        profile_pic: string | null;
    };
    category: {
        id: number;
        name: string;
        slug: string;
        responsive: string;
        banner: string;
        parent_category: {
            id: number;
            slug: string;
        };
    };
    creator: {
        id: number;
        username: string;
        slug: string;
        profile_pic: string | null;
    };
}

// ========== Kick Search Results ==========

export interface KickApiSearchResult {
    channels: KickApiChannel[];
    categories: KickApiCategory[];
    videos: KickApiVideo[];
}

// ========== Kick Chat Message ==========

export interface KickApiChatMessage {
    id: string;
    chatroom_id: number;
    content: string;
    type: string;
    created_at: string;
    sender: {
        id: number;
        username: string;
        slug: string;
        identity: {
            color: string;
            badges: KickChatBadge[];
        };
    };
}

export interface KickChatBadge {
    type: string;
    text: string;
    count?: number;
}

// ========== API Endpoints ==========
// Official Kick Dev API: https://docs.kick.com/

// Official public API for authenticated requests
export const KICK_API_BASE = 'https://api.kick.com/public/v1';

// Legacy undocumented API (for certain public endpoints that may still work)
export const KICK_API_V2_BASE = 'https://kick.com/api/v2';
export const KICK_API_V1_BASE = 'https://kick.com/api/v1';
