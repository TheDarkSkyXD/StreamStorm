/**
 * Unified API Module Index
 *
 * Exports all unified types and interfaces for platform-agnostic API access.
 */

// Platform types
export type {
    UnifiedStream,
    UnifiedChannel,
    UnifiedCategory,
    UnifiedUser,
    UnifiedFollow,
    UnifiedChatMessage,
    ParsedMessagePart,
    ChatBadge,
    UnifiedVideo,
    UnifiedClip,
    SocialLink,
    SearchResults,
    PaginationParams,
    ApiResponse,
    ApiError,
} from './platform-types';

// Platform client interface
export type {
    IPlatformClient,
    StreamPlaybackInfo,
    StreamQuality,
    PlatformClientFactory,
} from './platform-client';
