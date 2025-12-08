/**
 * Twitch API Module Index
 *
 * Exports all Twitch-specific API types, transformers, and client.
 */

// Twitch API Types
export type {
    TwitchApiUser,
    TwitchApiStream,
    TwitchApiChannel,
    TwitchApiGame,
    TwitchApiFollow,
    TwitchApiFollowedChannel,
    TwitchApiVideo,
    TwitchApiClip,
    TwitchApiSearchChannel,
    TwitchApiResponse,
    TwitchTokenValidation,
} from './twitch-types';

export { TWITCH_API_BASE, TWITCH_AUTH_BASE } from './twitch-types';

// Transformers
export {
    transformTwitchUser,
    transformTwitchStream,
    transformTwitchChannel,
    transformTwitchCategory,
    transformTwitchUserToChannel,
    transformTwitchSearchChannel,
    transformTwitchFollow,
    transformTwitchVideo,
    transformTwitchClip,
} from './twitch-transformers';

// Client
export {
    twitchClient,
    type PaginationOptions,
    type PaginatedResult,
    type TwitchClientError,
} from './twitch-client';
