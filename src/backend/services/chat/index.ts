/**
 * Chat Services Index
 *
 * Exports all chat-related backend services for both
 * Twitch and Kick platforms.
 */

// Re-export chat types for convenience
export type {
  ChatBadge,
  ChatConnectionState,
  ChatConnectionStatus,
  ChatEmote,
  ChatMessage,
  ChatPlatform,
  ChatServiceEvents,
  ClearChat,
  ContentFragment,
  MessageDeletion,
  UserNotice,
} from "../../../shared/chat-types";
// Badge Resolver
export { BadgeResolver, badgeResolver } from "./badge-resolver";
// Kick Chat
export { KickChatService, kickChatService } from "./kick-chat";
export type {
  KickBadge,
  KickChatClearedEvent,
  KickChatMessageEvent,
  KickGiftedSubEvent,
  KickHostRaidEvent,
  KickMessageDeletedEvent,
  KickSubscriptionEvent,
  KickUserBannedEvent,
  PusherEvent,
} from "./kick-parser";
export {
  isBroadcaster as isKickBroadcaster,
  isModerator as isKickModerator,
  isSubscriber as isKickSubscriber,
  isVIP as isKickVIP,
  parseKickChatCleared,
  parseKickChatMessage,
  parseKickGiftedSub,
  parseKickHostRaid,
  parseKickMessageDeleted,
  parseKickSubscription,
  parseKickUserBanned,
} from "./kick-parser";
// Twitch Chat
export { TwitchChatService, twitchChatService } from "./twitch-chat";
export type { TwitchTags } from "./twitch-parser";
export { parseTwitchMessage } from "./twitch-parser";
