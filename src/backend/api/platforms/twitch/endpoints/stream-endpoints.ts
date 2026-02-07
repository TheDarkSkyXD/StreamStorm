import type { UnifiedStream } from "../../../unified/platform-types";
import type { TwitchRequestor } from "../twitch-requestor";
import { transformTwitchStream } from "../twitch-transformers";
import type {
  PaginatedResult,
  PaginationOptions,
  TwitchApiResponse,
  TwitchApiStream,
} from "../twitch-types";

import { getUser, getUsersById } from "./user-endpoints";

/**
 * Get live streams for specific user IDs
 */
export async function getStreamsByUserIds(
  client: TwitchRequestor,
  userIds: string[],
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedStream>> {
  if (userIds.length === 0) return { data: [] };
  if (userIds.length > 100) {
    throw new Error("Cannot fetch more than 100 streams at once");
  }

  const params = new URLSearchParams({
    first: String(options.first || 100),
  });

  userIds.forEach((id) => params.append("user_id", id));

  if (options.after) {
    params.set("after", options.after);
  }

  const data = await client.request<TwitchApiResponse<TwitchApiStream>>(
    `/streams?${params.toString()}`
  );

  return {
    data: data.data.map(transformTwitchStream),
    cursor: data.pagination?.cursor,
  };
}

/**
 * Get live streams for followed channels
 */
export async function getFollowedStreams(
  client: TwitchRequestor,
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedStream>> {
  const user = await getUser(client);
  if (!user) {
    throw new Error("Must be authenticated to get followed streams");
  }

  const params = new URLSearchParams({
    user_id: user.id,
    first: String(options.first || 100),
  });

  if (options.after) {
    params.set("after", options.after);
  }

  const data = await client.request<TwitchApiResponse<TwitchApiStream>>(
    `/streams/followed?${params.toString()}`
  );

  return {
    data: data.data.map(transformTwitchStream),
    cursor: data.pagination?.cursor,
  };
}

/**
 * Get top live streams
 */
export async function getTopStreams(
  client: TwitchRequestor,
  options: PaginationOptions & { gameId?: string; language?: string } = {}
): Promise<PaginatedResult<UnifiedStream>> {
  const params = new URLSearchParams({
    first: String(options.first || 20),
  });

  if (options.after) {
    params.set("after", options.after);
  }
  if (options.gameId) {
    params.set("game_id", options.gameId);
  }
  if (options.language) {
    params.set("language", options.language);
  }

  const data = await client.request<TwitchApiResponse<TwitchApiStream>>(
    `/streams?${params.toString()}`
  );

  // Fetch user info to get avatars
  const userIds = data.data.map((s) => s.user_id);
  const users = await getUsersById(client, userIds);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const streams = data.data.map((stream) => {
    const unifiedStream = transformTwitchStream(stream);
    const user = userMap.get(stream.user_id);
    if (user) {
      unifiedStream.channelAvatar = user.profileImageUrl;
    }
    return unifiedStream;
  });

  return {
    data: streams,
    cursor: data.pagination?.cursor,
  };
}

/**
 * Get a specific stream by user login
 */
export async function getStreamByLogin(
  client: TwitchRequestor,
  login: string
): Promise<UnifiedStream | null> {
  const params = new URLSearchParams({ user_login: login });
  const data = await client.request<TwitchApiResponse<TwitchApiStream>>(
    `/streams?${params.toString()}`
  );

  if (data.data && data.data.length > 0) {
    return transformTwitchStream(data.data[0]);
  }
  return null;
}
