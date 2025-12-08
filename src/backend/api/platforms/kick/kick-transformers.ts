/**
 * Kick Data Transformers
 *
 * Functions to transform Kick API responses into unified types.
 */

import type {
    UnifiedStream,
    UnifiedChannel,
    UnifiedCategory,
    UnifiedUser,
    UnifiedFollow,
    UnifiedVideo,
    UnifiedClip,
    SocialLink,
} from '../../unified/platform-types';

import type {
    KickApiUser,
    KickApiChannel,
    KickApiLivestream,
    KickApiCategory,
    KickApiVideo,
    KickApiClip,
} from './kick-types';

/**
 * Transform Kick user to unified user
 */
export function transformKickUser(user: KickApiUser): UnifiedUser {
    return {
        id: user.id.toString(),
        platform: 'kick',
        username: user.username,
        displayName: user.username,
        avatarUrl: user.profile_pic || '',
        isVerified: false, // Not available in basic user data
        createdAt: '', // Not available in basic user data
    };
}

/**
 * Transform Kick channel to unified channel
 */
export function transformKickChannel(channel: KickApiChannel): UnifiedChannel {
    const socialLinks: SocialLink[] = [];

    // Collect social links from user data
    const user = channel.user;
    if (user.instagram) socialLinks.push({ platform: 'instagram', url: user.instagram });
    if (user.twitter) socialLinks.push({ platform: 'twitter', url: user.twitter });
    if (user.youtube) socialLinks.push({ platform: 'youtube', url: user.youtube });
    if (user.discord) socialLinks.push({ platform: 'discord', url: user.discord });
    if (user.tiktok) socialLinks.push({ platform: 'tiktok', url: user.tiktok });
    if (user.facebook) socialLinks.push({ platform: 'facebook', url: user.facebook });

    return {
        id: channel.id.toString(),
        platform: 'kick',
        username: channel.slug,
        displayName: channel.user.username,
        avatarUrl: channel.user.profile_pic || '',
        bannerUrl: channel.banner_image?.src,
        bio: channel.user.bio || undefined,
        isLive: channel.livestream?.is_live || false,
        isVerified: channel.verified,
        isPartner: channel.verified, // Kick uses verified badge similar to partner
        followerCount: channel.followers_count,
        socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
    };
}

/**
 * Transform Kick livestream to unified stream
 */
export function transformKickStream(
    livestream: KickApiLivestream,
    channel: KickApiChannel
): UnifiedStream {
    const category = livestream.categories[0];

    return {
        id: livestream.id.toString(),
        platform: 'kick',
        channelId: channel.id.toString(),
        channelName: channel.slug,
        channelDisplayName: channel.user.username,
        channelAvatar: channel.user.profile_pic || '',
        title: livestream.session_title,
        viewerCount: livestream.viewer_count,
        thumbnailUrl: livestream.thumbnail?.src || '',
        isLive: livestream.is_live,
        startedAt: livestream.start_time,
        language: livestream.language,
        tags: livestream.tags || [],
        categoryId: category?.id.toString(),
        categoryName: category?.name,
    };
}

/**
 * Transform Kick category to unified category
 */
export function transformKickCategory(category: KickApiCategory): UnifiedCategory {
    return {
        id: category.id.toString(),
        platform: 'kick',
        name: category.name,
        boxArtUrl: category.banner?.src || '',
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
        id: `kick-${channel.id}`,
        platform: 'kick',
        channel: transformKickChannel(channel),
        followedAt: followedAt || new Date().toISOString(),
        notifications: false, // Default, can be updated
    };
}

/**
 * Transform Kick video to unified video
 */
export function transformKickVideo(video: KickApiVideo): UnifiedVideo {
    const livestream = video.livestream;
    const channel = livestream.channel;

    return {
        id: video.id.toString(),
        platform: 'kick',
        channelId: channel.id.toString(),
        channelName: channel.user.username,
        title: livestream.session_title,
        thumbnailUrl: video.thumb || '',
        duration: livestream.duration,
        viewCount: video.views,
        publishedAt: video.created_at,
        url: `https://kick.com/${channel.slug}?video=${video.uuid}`,
        type: 'archive', // Kick mainly has archives
    };
}

/**
 * Transform Kick clip to unified clip
 */
export function transformKickClip(clip: KickApiClip): UnifiedClip {
    return {
        id: clip.id,
        platform: 'kick',
        channelId: clip.channel_id.toString(),
        channelName: clip.channel.username,
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
