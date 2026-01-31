/**
 * Kick WebSocket Message Parser
 *
 * Parses Kick Pusher WebSocket messages into our unified ChatMessage format.
 * Handles chat messages, events (subs, gifts, raids), and moderation actions.
 */

import type {
    ChatMessage,
    ChatBadge,
    ContentFragment,
    UserNotice,
    ClearChat,
    MessageDeletion,
    MessageType,
} from '../../../shared/chat-types';

// ========== Kick WebSocket Event Types ==========

/** Raw Kick chat message from Pusher WebSocket */
export interface KickChatMessageEvent {
    id: string;
    chatroom_id: number;
    content: string;
    type: string; // 'message', 'reply', etc.
    created_at: string;
    sender: {
        id: number;
        username: string;
        slug: string;
        identity: {
            color: string;
            badges: KickBadge[];
        };
    };
    metadata?: {
        original_sender?: {
            id: number;
            username: string;
        };
        original_message?: {
            id: string;
            content: string;
        };
    };
}

/** Kick badge structure */
export interface KickBadge {
    type: string; // 'subscriber', 'moderator', 'broadcaster', 'vip', 'og', 'founder', 'verified'
    text: string;
    count?: number; // For subscriber months
}

/** Kick subscription event */
export interface KickSubscriptionEvent {
    chatroom_id: number;
    username: string;
    months: number;
}

/** Kick gifted subscription event */
export interface KickGiftedSubEvent {
    chatroom_id: number;
    gifter_username: string;
    gifted_usernames: string[];
}

/** Kick user banned event */
export interface KickUserBannedEvent {
    id: string;
    user: {
        id: number;
        username: string;
        slug: string;
    };
    banned_by?: {
        id: number;
        username: string;
        slug: string;
    };
    permanent?: boolean;
    duration?: number; // In minutes
}

/** Kick user unbanned event */
export interface KickUserUnbannedEvent {
    id: string;
    user: {
        id: number;
        username: string;
        slug: string;
    };
    unbanned_by?: {
        id: number;
        username: string;
        slug: string;
    };
}

/** Kick message deleted event */
export interface KickMessageDeletedEvent {
    id: string;
    message: {
        id: string;
    };
}

/** Kick chat cleared event */
export interface KickChatClearedEvent {
    id: string;
}

/** Kick host/raid event */
export interface KickHostRaidEvent {
    chatroom_id: number;
    host_username?: string;
    number_viewers?: number;
    optional_message?: string;
}

/** Kick follow event */
export interface KickFollowEvent {
    chatroom_id: number;
    username: string;
    followers_count: number;
}

// ========== Pusher Protocol Types ==========

export interface PusherEvent {
    event: string;
    channel?: string;
    data: string; // JSON string
}

export type KickEventType =
    | 'App\\Events\\ChatMessageEvent'
    | 'App\\Events\\MessageDeletedEvent'
    | 'App\\Events\\UserBannedEvent'
    | 'App\\Events\\UserUnbannedEvent'
    | 'App\\Events\\ChatroomClearEvent'
    | 'App\\Events\\SubscriptionEvent'
    | 'App\\Events\\GiftedSubscriptionsEvent'
    | 'App\\Events\\FollowersUpdated'
    | 'App\\Events\\StreamHostEvent'
    | 'App\\Events\\ChatMoveToBannedEvent'
    | 'App\\Events\\PollUpdateEvent'
    | 'App\\Events\\PinnedMessageCreatedEvent'
    | 'App\\Events\\PinnedMessageDeletedEvent';

// ========== Default Colors ==========

const DEFAULT_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#00CED1', '#FF6347', '#7B68EE', '#3CB371',
];

/**
 * Get a consistent color for a user based on their username
 */
function getDefaultColor(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

// ========== Badge Mapping ==========

const KICK_BADGE_IMAGE_MAP: Record<string, string> = {
    broadcaster: 'https://kick.com/static-assets/images/badges/broadcaster-badge.svg',
    moderator: 'https://kick.com/static-assets/images/badges/moderator-badge.svg',
    vip: 'https://kick.com/static-assets/images/badges/vip-badge.svg',
    verified: 'https://kick.com/static-assets/images/badges/verified-badge.svg',
    og: 'https://kick.com/static-assets/images/badges/og-badge.svg',
    founder: 'https://kick.com/static-assets/images/badges/founder-badge.svg',
    subscriber: 'https://kick.com/static-assets/images/badges/subscriber-badge.svg',
};

/**
 * Map Kick badges to our unified ChatBadge format
 */
function parseKickBadges(badges: KickBadge[]): ChatBadge[] {
    return badges.map((badge) => {
        const imageUrl = KICK_BADGE_IMAGE_MAP[badge.type] || '';
        const title = badge.text || badge.type;

        return {
            setId: badge.type,
            version: badge.count?.toString() ?? '1',
            imageUrl,
            title,
        };
    });
}

// ========== Content Parsing ==========

/**
 * Parse emotes from Kick message content
 * Kick uses [emote:id:name] format in messages
 */
function parseKickEmotes(content: string): { cleanContent: string; fragments: ContentFragment[] } {
    const fragments: ContentFragment[] = [];
    const emoteRegex = /\[emote:(\d+):([^\]]+)\]/g;

    let lastIndex = 0;
    let match;
    let cleanContent = content;

    // First pass: collect all emote positions
    const emotePositions: Array<{ match: string; id: string; name: string; start: number; end: number }> = [];

    while ((match = emoteRegex.exec(content)) !== null) {
        emotePositions.push({
            match: match[0],
            id: match[1],
            name: match[2],
            start: match.index,
            end: match.index + match[0].length,
        });
    }

    // Build fragments
    lastIndex = 0;
    for (const emote of emotePositions) {
        // Add text before emote
        if (lastIndex < emote.start) {
            const textBefore = content.substring(lastIndex, emote.start);
            if (textBefore) {
                fragments.push(...parseTextFragment(textBefore));
            }
        }

        // Add emote fragment
        fragments.push({
            type: 'emote',
            id: emote.id,
            name: emote.name,
            url: getKickEmoteUrl(emote.id),
        });

        lastIndex = emote.end;
    }

    // Add remaining text
    if (lastIndex < content.length) {
        const remainingText = content.substring(lastIndex);
        if (remainingText) {
            fragments.push(...parseTextFragment(remainingText));
        }
    }

    // Clean content for raw display
    cleanContent = content.replace(emoteRegex, (_, __, name) => name);

    // If no emotes found, parse the whole content as text
    if (fragments.length === 0 && content) {
        fragments.push(...parseTextFragment(content));
    }

    return { cleanContent, fragments };
}

/**
 * Get Kick emote URL
 */
function getKickEmoteUrl(emoteId: string): string {
    return `https://files.kick.com/emotes/${emoteId}/fullsize`;
}

/**
 * Parse text fragment for mentions and links
 */
function parseTextFragment(text: string): ContentFragment[] {
    const fragments: ContentFragment[] = [];

    // URL regex
    const urlRegex = /https?:\/\/[^\s]+/g;
    // Mention regex
    const mentionRegex = /@(\w+)/g;

    // Combined parsing - find all special tokens
    const tokens: Array<{
        type: 'url' | 'mention';
        value: string;
        start: number;
        end: number;
        username?: string;
    }> = [];

    // Find URLs
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        tokens.push({
            type: 'url',
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
        });
    }

    // Find mentions
    while ((match = mentionRegex.exec(text)) !== null) {
        tokens.push({
            type: 'mention',
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            username: match[1],
        });
    }

    // Sort by position
    tokens.sort((a, b) => a.start - b.start);

    // Build fragments
    let currentIndex = 0;

    for (const token of tokens) {
        // Skip overlapping tokens
        if (token.start < currentIndex) continue;

        // Add text before token
        if (currentIndex < token.start) {
            const textBefore = text.substring(currentIndex, token.start);
            if (textBefore) {
                fragments.push({ type: 'text', content: textBefore });
            }
        }

        // Add token
        if (token.type === 'url') {
            fragments.push({
                type: 'link',
                url: token.value,
                text: token.value,
            });
        } else if (token.type === 'mention' && token.username) {
            fragments.push({
                type: 'mention',
                username: token.username,
            });
        }

        currentIndex = token.end;
    }

    // Add remaining text
    if (currentIndex < text.length) {
        const remainingText = text.substring(currentIndex);
        if (remainingText) {
            fragments.push({ type: 'text', content: remainingText });
        }
    }

    // If no tokens found, just return the text
    if (fragments.length === 0 && text) {
        fragments.push({ type: 'text', content: text });
    }

    return fragments;
}

// ========== Main Parsers ==========

/**
 * Parse a Kick chat message event into our unified ChatMessage format
 */
export function parseKickChatMessage(
    event: KickChatMessageEvent,
    channel: string
): ChatMessage {
    const { cleanContent, fragments } = parseKickEmotes(event.content);

    // Determine message type
    let messageType: MessageType = 'message';
    if (event.type === 'reply') {
        messageType = 'message'; // Replies are still messages, but with replyTo set
    }

    // Parse reply info if present
    const replyTo = event.metadata?.original_message
        ? {
            parentMessageId: event.metadata.original_message.id,
            parentUserId: event.metadata.original_sender?.id.toString() ?? '',
            parentUsername: event.metadata.original_sender?.username ?? '',
            parentDisplayName: event.metadata.original_sender?.username ?? '',
            parentMessageBody: event.metadata.original_message.content,
        }
        : undefined;

    return {
        id: event.id,
        platform: 'kick',
        type: messageType,
        channel,
        userId: event.sender.id.toString(),
        username: event.sender.slug,
        displayName: event.sender.username,
        color: event.sender.identity.color || getDefaultColor(event.sender.username),
        badges: parseKickBadges(event.sender.identity.badges),
        content: fragments,
        rawContent: cleanContent,
        timestamp: new Date(event.created_at),
        isDeleted: false,
        isHighlighted: false,
        isAction: false,
        replyTo,
    };
}

/**
 * Parse a Kick subscription event into our UserNotice format
 */
export function parseKickSubscription(
    event: KickSubscriptionEvent,
    channel: string
): UserNotice {
    const isResub = event.months > 1;

    return {
        id: crypto.randomUUID(),
        platform: 'kick',
        channel,
        type: isResub ? 'resub' : 'sub',
        userId: '',
        username: event.username.toLowerCase(),
        displayName: event.username,
        systemMessage: isResub
            ? `${event.username} has resubscribed for ${event.months} months!`
            : `${event.username} subscribed!`,
        timestamp: new Date(),
        months: event.months,
        cumulativeMonths: event.months,
    };
}

/**
 * Parse a Kick gifted subscription event into our UserNotice format
 */
export function parseKickGiftedSub(
    event: KickGiftedSubEvent,
    channel: string
): UserNotice {
    return {
        id: crypto.randomUUID(),
        platform: 'kick',
        channel,
        type: 'subgift',
        userId: '',
        username: event.gifter_username.toLowerCase(),
        displayName: event.gifter_username,
        systemMessage: `${event.gifter_username} gifted ${event.gifted_usernames.length} subscription(s)!`,
        timestamp: new Date(),
        giftCount: event.gifted_usernames.length,
    };
}

/**
 * Parse a Kick user banned event into our ClearChat format
 */
export function parseKickUserBanned(
    event: KickUserBannedEvent,
    channel: string
): ClearChat {
    return {
        platform: 'kick',
        channel,
        targetUserId: event.user.id.toString(),
        targetUsername: event.user.username,
        duration: event.permanent ? undefined : (event.duration ?? 0) * 60, // Convert minutes to seconds
        isClearAll: false,
        timestamp: new Date(),
    };
}

/**
 * Parse a Kick message deleted event
 */
export function parseKickMessageDeleted(
    event: KickMessageDeletedEvent,
    channel: string
): MessageDeletion {
    return {
        platform: 'kick',
        channel,
        messageId: event.message.id,
        timestamp: new Date(),
    };
}

/**
 * Parse a Kick chat cleared event
 */
export function parseKickChatCleared(
    event: KickChatClearedEvent,
    channel: string
): ClearChat {
    return {
        platform: 'kick',
        channel,
        isClearAll: true,
        timestamp: new Date(),
    };
}

/**
 * Parse a Kick host/raid event into our UserNotice format
 */
export function parseKickHostRaid(
    event: KickHostRaidEvent,
    channel: string
): UserNotice {
    return {
        id: crypto.randomUUID(),
        platform: 'kick',
        channel,
        type: 'raid',
        userId: '',
        username: event.host_username?.toLowerCase() ?? '',
        displayName: event.host_username ?? '',
        systemMessage: `${event.host_username} is raiding with ${event.number_viewers} viewers!`,
        timestamp: new Date(),
        viewerCount: event.number_viewers,
    };
}

// ========== Utility Functions ==========

/**
 * Check if user has broadcaster badge
 */
export function isBroadcaster(badges: ChatBadge[]): boolean {
    return badges.some((b) => b.setId === 'broadcaster');
}

/**
 * Check if user has moderator badge
 */
export function isModerator(badges: ChatBadge[]): boolean {
    return badges.some((b) => b.setId === 'moderator' || b.setId === 'broadcaster');
}

/**
 * Check if user has VIP badge
 */
export function isVIP(badges: ChatBadge[]): boolean {
    return badges.some((b) => b.setId === 'vip');
}

/**
 * Check if user has subscriber badge
 */
export function isSubscriber(badges: ChatBadge[]): boolean {
    return badges.some((b) => b.setId === 'subscriber' || b.setId === 'founder');
}
