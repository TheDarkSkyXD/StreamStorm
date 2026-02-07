/**
 * ID Utilities
 *
 * Centralized functions for generating unique, platform-aware identifiers.
 * These utilities prevent key collisions when the same streamer is followed
 * on both Twitch and Kick platforms.
 *
 * IMPORTANT: Always use these functions when:
 * - Creating React element keys for channels/streams
 * - Storing or looking up channels/streams in Maps/Sets
 * - Comparing channels/streams for equality
 * - Checking follow status
 */

import type { UnifiedChannel, UnifiedStream } from "@/backend/api/unified/platform-types";
import type { Platform } from "@/shared/auth-types";

/**
 * Creates a unique key for a channel that includes the platform.
 * This prevents collisions when a user follows the same streamer on both Twitch and Kick.
 *
 * @example
 * getChannelKey({ platform: 'twitch', id: '12345' }) // => 'twitch-12345'
 * getChannelKey({ platform: 'kick', id: '12345' })   // => 'kick-12345'
 */
export function getChannelKey(channel: Pick<UnifiedChannel, "platform" | "id">): string {
  return `${channel.platform}-${channel.id}`;
}

/**
 * Creates a unique key for a stream that includes the platform.
 * Uses channelId from the stream for consistency with channel keys.
 *
 * @example
 * getStreamKey({ platform: 'twitch', channelId: '12345' }) // => 'twitch-12345'
 */
export function getStreamKey(stream: Pick<UnifiedStream, "platform" | "channelId">): string {
  return `${stream.platform}-${stream.channelId}`;
}

/**
 * Creates a unique key for a stream using its own ID (not channel ID).
 * Use this for stream-specific operations like React keys in stream lists.
 *
 * @example
 * getStreamElementKey({ platform: 'twitch', id: 'stream123' }) // => 'twitch-stream123'
 */
export function getStreamElementKey(stream: Pick<UnifiedStream, "platform" | "id">): string {
  return `${stream.platform}-${stream.id}`;
}

/**
 * Creates a channel lookup key using platform and username (slug).
 * Usernames are lowercased for case-insensitive matching.
 *
 * @example
 * getChannelNameKey('twitch', 'xQc') // => 'twitch-xqc'
 */
export function getChannelNameKey(platform: Platform, username: string): string {
  return `${platform}-${username.toLowerCase()}`;
}

/**
 * Parses a platform-aware key back into its components.
 *
 * @example
 * parseKey('twitch-12345') // => { platform: 'twitch', id: '12345' }
 */
export function parseKey(key: string): { platform: Platform; id: string } | null {
  const dashIndex = key.indexOf("-");
  if (dashIndex === -1) return null;

  const platform = key.substring(0, dashIndex) as Platform;
  const id = key.substring(dashIndex + 1);

  if (!id) return null;

  if (platform !== "twitch" && platform !== "kick") return null;

  return { platform, id };
}

/**
 * Checks if two channels are the same (same platform AND same ID).
 *
 * @example
 * isSameChannel(twitchXqc, kickXqc)   // => false (different platforms)
 * isSameChannel(twitchXqc, twitchXqc) // => true
 */
export function isSameChannel(
  a: Pick<UnifiedChannel, "platform" | "id">,
  b: Pick<UnifiedChannel, "platform" | "id">
): boolean {
  return a.platform === b.platform && a.id === b.id;
}

/**
 * Checks if a channel matches a given key.
 * The key can be in several formats:
 * - Platform-aware: "twitch-12345" or "kick-xqc"
 * - Legacy (just ID): "12345" - will match any platform with that ID
 * - Username: "xqc" - will match any platform with that username
 *
 * For new code, always use platform-aware keys for precise matching.
 */
export function channelMatchesKey(
  channel: Pick<UnifiedChannel, "platform" | "id" | "username">,
  key: string
): boolean {
  // Try platform-aware match first (preferred)
  if (getChannelKey(channel) === key) return true;

  // Try platform-username match
  if (channel.username && getChannelNameKey(channel.platform, channel.username) === key) {
    return true;
  }

  // Legacy fallback: match by ID only (not recommended, but needed for backward compatibility)
  if (channel.id === key) return true;

  // Legacy fallback: match by username (case-insensitive)
  if (channel.username?.toLowerCase() === key?.toLowerCase()) return true;

  return false;
}
