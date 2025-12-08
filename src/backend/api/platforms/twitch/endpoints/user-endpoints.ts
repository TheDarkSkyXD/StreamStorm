import type { TwitchUser } from '../../../../../shared/auth-types';
import type { UnifiedChannel } from '../../../unified/platform-types';
import type { TwitchRequestor } from '../twitch-requestor';
import type {
    TwitchApiResponse,
    TwitchApiUser,
    TwitchApiFollowedChannel,
    PaginationOptions,
    PaginatedResult
} from '../twitch-types';
import { getChannelsById } from './channel-endpoints';

/**
 * Get the currently authenticated user
 */
export async function getUser(client: TwitchRequestor): Promise<TwitchUser | null> {
    try {
        const data = await client.request<TwitchApiResponse<TwitchApiUser>>('/users');
        if (data.data && data.data.length > 0) {
            const apiUser = data.data[0];
            return {
                id: apiUser.id,
                login: apiUser.login,
                displayName: apiUser.display_name,
                profileImageUrl: apiUser.profile_image_url,
                email: apiUser.email,
                createdAt: apiUser.created_at,
                broadcasterType: apiUser.broadcaster_type,
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Failed to get Twitch user:', error);
        return null;
    }
}

/**
 * Get users by their IDs
 */
export async function getUsersById(
    client: TwitchRequestor,
    ids: string[]
): Promise<TwitchUser[]> {
    if (ids.length === 0) return [];
    if (ids.length > 100) {
        throw new Error('Cannot fetch more than 100 users at once');
    }

    const queryString = ids.map((id) => `id=${id}`).join('&');
    const data = await client.request<TwitchApiResponse<TwitchApiUser>>(
        `/users?${queryString}`
    );

    return data.data.map((u) => ({
        id: u.id,
        login: u.login,
        displayName: u.display_name,
        profileImageUrl: u.profile_image_url,
        email: u.email,
        createdAt: u.created_at,
        broadcasterType: u.broadcaster_type,
    }));
}

/**
 * Get users by their login names
 */
export async function getUsersByLogin(
    client: TwitchRequestor,
    logins: string[]
): Promise<TwitchUser[]> {
    if (logins.length === 0) return [];
    if (logins.length > 100) {
        throw new Error('Cannot fetch more than 100 users at once');
    }

    const queryString = logins.map((login) => `login=${login}`).join('&');
    const data = await client.request<TwitchApiResponse<TwitchApiUser>>(
        `/users?${queryString}`
    );

    return data.data.map((u) => ({
        id: u.id,
        login: u.login,
        displayName: u.display_name,
        profileImageUrl: u.profile_image_url,
        email: u.email,
        createdAt: u.created_at,
        broadcasterType: u.broadcaster_type,
    }));
}

/**
 * Get channels followed by the authenticated user
 */
export async function getFollowedChannels(
    client: TwitchRequestor,
    options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedChannel>> {
    const user = await getUser(client);
    if (!user) {
        throw new Error('Must be authenticated to get followed channels');
    }

    const params = new URLSearchParams({
        user_id: user.id,
        first: String(options.first || 100),
    });

    if (options.after) {
        params.set('after', options.after);
    }

    const data = await client.request<TwitchApiResponse<TwitchApiFollowedChannel>>(
        `/channels/followed?${params.toString()}`
    );

    // Get full channel info for each followed channel
    const channelIds = data.data.map((f) => f.broadcaster_id);
    const channels = await getChannelsById(client, channelIds);

    return {
        data: channels,
        cursor: data.pagination?.cursor,
        total: data.total,
    };
}

/**
 * Get all followed channels (handles pagination automatically)
 */
export async function getAllFollowedChannels(
    client: TwitchRequestor
): Promise<UnifiedChannel[]> {
    const allChannels: UnifiedChannel[] = [];
    let cursor: string | undefined;

    do {
        const result = await getFollowedChannels(client, { after: cursor, first: 100 });
        allChannels.push(...result.data);
        cursor = result.cursor;
    } while (cursor);

    return allChannels;
}
