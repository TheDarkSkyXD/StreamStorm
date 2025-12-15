/**
 * Kick Data Transformers
 *
 * Functions to transform official Kick API responses into unified types.
 * API Documentation: https://docs.kick.com/
 */

import type {
    UnifiedStream,
    UnifiedChannel,
    UnifiedCategory,
    UnifiedUser,
    UnifiedFollow,
    UnifiedClip,
} from '../../unified/platform-types';

import type {
    KickApiUser,
    KickApiChannel,
    KickApiLivestream,
    KickApiCategory,
    KickLegacyApiClip,
} from './kick-types';

/**
 * Transform official Kick API user to unified user
 * Endpoint: GET /public/v1/users
 */
export function transformKickUser(user: KickApiUser): UnifiedUser {
    return {
        id: user.user_id.toString(),
        platform: 'kick',
        username: user.name,
        displayName: user.name,
        avatarUrl: user.profile_picture || '',
        isVerified: false, // Not available in API
        createdAt: '', // Not available in API
    };
}

/**
 * Transform official Kick API channel to unified channel
 * Endpoint: GET /public/v1/channels
 */
export function transformKickChannel(channel: KickApiChannel): UnifiedChannel {
    return {
        id: channel.broadcaster_user_id.toString(),
        platform: 'kick',
        username: channel.slug,
        displayName: channel.slug,
        avatarUrl: '', // Not provided in official API
        bannerUrl: (channel as any).offline_banner_image?.src || (channel as any).offline_banner_image?.url || (typeof (channel as any).offline_banner_image === 'string' ? (channel as any).offline_banner_image : undefined),
        bio: channel.channel_description || undefined,
        isLive: channel.stream?.is_live || false,
        isVerified: false, // Not provided in official API
        isPartner: false, // Not provided in official API
    };
}

/**
 * Transform official Kick API livestream to unified stream
 * Endpoint: GET /public/v1/livestreams
 */
export function transformKickLivestream(livestream: KickApiLivestream): UnifiedStream {
    return {
        id: livestream.channel_id.toString(),
        platform: 'kick',
        channelId: livestream.broadcaster_user_id.toString(),
        channelName: livestream.slug,
        channelDisplayName: livestream.slug,
        channelAvatar: '', // Not provided in livestreams endpoint
        title: livestream.stream_title,
        viewerCount: livestream.viewer_count,
        thumbnailUrl: livestream.thumbnail || '',
        isLive: true,
        startedAt: livestream.started_at,
        language: livestream.language,
        tags: livestream.custom_tags || [],
        isMature: livestream.has_mature_content,
        categoryId: livestream.category.id.toString(),
        categoryName: livestream.category.name,
    };
}

/**
 * Transform official Kick API category to unified category
 * Endpoint: GET /public/v1/categories
 */
export function transformKickCategory(category: KickApiCategory): UnifiedCategory {
    return {
        id: category.id.toString(),
        platform: 'kick',
        name: category.name,
        boxArtUrl: category.thumbnail || '',
    };
}

/**
 * Transform Kick channel to unified follow
 */
export function transformKickFollow(
    channel: KickApiChannel,
    followedAt?: string
): UnifiedFollow {
    return {
        id: `kick-${channel.broadcaster_user_id}`,
        platform: 'kick',
        channel: transformKickChannel(channel),
        followedAt: followedAt || new Date().toISOString(),
        notifications: false, // Default, can be updated
    };
}

/**
 * Transform legacy Kick clip to unified clip
 * Note: Clips are NOT in the official API, this uses legacy undocumented API format
 */
export function transformKickClip(clip: KickLegacyApiClip): UnifiedClip {
    return {
        id: clip.id,
        platform: 'kick',
        channelId: clip.channel_id.toString(),
        channelName: clip.channel.slug,
        channelDisplayName: clip.channel.username,
        channelAvatar: clip.channel.profile_pic || '',
        title: clip.title,
        thumbnailUrl: clip.thumbnail_url,
        clipUrl: clip.clip_url,
        embedUrl: clip.video_url,
        duration: clip.duration,
        viewCount: clip.view_count,
        createdAt: clip.created_at,
        creatorName: clip.creator.username,
        gameId: clip.category_id,
        gameName: clip.category.name,
    };
}
