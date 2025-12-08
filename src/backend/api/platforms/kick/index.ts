/**
 * Kick API Module Index
 *
 * Exports all Kick-specific API types, transformers, and client.
 */

// === Official Kick API Types (https://docs.kick.com/) ===
export type {
    KickApiResponse,
    KickApiUser,
    KickApiTokenIntrospect,
    KickApiChannel,
    KickApiChannelCategory,
    KickApiChannelStream,
    KickApiLivestream,
    KickApiLivestreamStats,
    KickApiCategory,
    KickApiChannelReward,
    KickApiCreateRewardRequest,
    KickApiChatMessageRequest,
    KickApiChatMessageResponse,
    KickApiModerationBanRequest,
    KickApiLeaderboardEntry,
    KickApiKicksLeaderboard,
    KickApiPublicKey,
    KickApiScope,
} from './kick-types';

export {
    KICK_API_BASE,
    KICK_API_SCOPES,
    KICK_LEGACY_API_V1_BASE,
    KICK_LEGACY_API_V2_BASE,
} from './kick-types';

// === Legacy Types (undocumented API) ===
export type {
    KickLegacyApiClip,
} from './kick-types';

// Client
export { kickClient } from './kick-client';
