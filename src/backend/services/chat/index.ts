/**
 * Chat Services Index
 *
 * Exports all chat-related backend services for both
 * Twitch and Kick platforms.
 */

// Twitch Chat
export { TwitchChatService, twitchChatService } from './twitch-chat';
export { parseTwitchMessage } from './twitch-parser';
export type { TwitchTags } from './twitch-parser';

// Badge Resolver
export { BadgeResolver, badgeResolver } from './badge-resolver';

// Re-export chat types for convenience
export type {
    ChatMessage,
    ChatBadge,
    ChatEmote,
    ContentFragment,
    UserNotice,
    ClearChat,
    MessageDeletion,
    ChatConnectionStatus,
    ChatConnectionState,
    ChatPlatform,
    ChatServiceEvents,
} from '../../../shared/chat-types';
