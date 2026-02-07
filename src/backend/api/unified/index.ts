/**
 * Unified API Module Index
 *
 * Exports all unified types and interfaces for platform-agnostic API access.
 */

// Platform client interface
export type {
  IPlatformClient,
  PlatformClientFactory,
  StreamPlaybackInfo,
  StreamQuality,
} from "./platform-client";
// Platform types
export type {
  ApiError,
  ApiResponse,
  ChatBadge,
  PaginationParams,
  ParsedMessagePart,
  SearchResults,
  SocialLink,
  UnifiedCategory,
  UnifiedChannel,
  UnifiedChatMessage,
  UnifiedClip,
  UnifiedFollow,
  UnifiedStream,
  UnifiedUser,
  UnifiedVideo,
} from "./platform-types";
