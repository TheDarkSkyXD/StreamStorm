/**
 * Twitch API Module Index
 *
 * Exports all Twitch-specific API types, transformers, and client.
 */

// Client
export {
  type PaginatedResult,
  type PaginationOptions,
  type TwitchClientError,
  twitchClient,
} from "./twitch-client";
// Transformers
export {
  transformTwitchCategory,
  transformTwitchChannel,
  transformTwitchClip,
  transformTwitchFollow,
  transformTwitchSearchChannel,
  transformTwitchStream,
  transformTwitchUser,
  transformTwitchUserToChannel,
  transformTwitchVideo,
} from "./twitch-transformers";
// Twitch API Types
export type {
  TwitchApiChannel,
  TwitchApiClip,
  TwitchApiFollow,
  TwitchApiFollowedChannel,
  TwitchApiGame,
  TwitchApiResponse,
  TwitchApiSearchChannel,
  TwitchApiStream,
  TwitchApiUser,
  TwitchApiVideo,
  TwitchTokenValidation,
} from "./twitch-types";
export { TWITCH_API_BASE, TWITCH_AUTH_BASE } from "./twitch-types";
