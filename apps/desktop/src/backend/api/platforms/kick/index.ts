/**
 * Kick API Module Index
 *
 * Exports all Kick-specific API types, transformers, and client.
 */

// Client
export { kickClient } from "./kick-client";
// === Official Kick API Types (https://docs.kick.com/) ===
// === Legacy Types (undocumented API) ===
export type {
  KickApiCategory,
  KickApiChannel,
  KickApiChannelCategory,
  KickApiChannelReward,
  KickApiChannelStream,
  KickApiChatMessageRequest,
  KickApiChatMessageResponse,
  KickApiCreateRewardRequest,
  KickApiKicksLeaderboard,
  KickApiLeaderboardEntry,
  KickApiLivestream,
  KickApiLivestreamStats,
  KickApiModerationBanRequest,
  KickApiPublicKey,
  KickApiResponse,
  KickApiScope,
  KickApiTokenIntrospect,
  KickApiUser,
  KickLegacyApiClip,
} from "./kick-types";
export {
  KICK_API_BASE,
  KICK_API_SCOPES,
  KICK_LEGACY_API_V1_BASE,
  KICK_LEGACY_API_V2_BASE,
} from "./kick-types";
