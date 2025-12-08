/**
 * Kick API Module Index
 *
 * Exports all Kick-specific API types, transformers, and client.
 */

// Kick API Types
export type {
    KickApiUser,
    KickApiChannel,
    KickApiChannelUser,
    KickApiLivestream,
    KickApiCategory,
    KickApiVideo,
    KickApiClip,
    KickApiSearchResult,
    KickApiChatMessage,
    KickChatBadge,
    KickSubscriberBadge,
    KickImage,
} from './kick-types';

export { KICK_API_BASE, KICK_API_V1_BASE } from './kick-types';

// Transformers
export {
    transformKickUser,
    transformKickChannel,
    transformKickStream,
    transformKickCategory,
    transformKickFollow,
    transformKickVideo,
    transformKickClip,
} from './kick-transformers';

// Client will be exported here once created in Phase 1.4
// export { KickClient } from './kick-client';
