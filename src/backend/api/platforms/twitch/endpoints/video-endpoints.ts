import type { TwitchRequestor } from '../twitch-requestor';
import type {
    TwitchApiResponse,
    TwitchApiVideo,
    PaginationOptions,
    PaginatedResult
} from '../twitch-types';

/**
 * Get videos by user ID
 */
export async function getVideosByUser(
    client: TwitchRequestor,
    userId: string,
    options: PaginationOptions & { type?: 'archive' | 'highlight' | 'upload' } = {}
): Promise<PaginatedResult<TwitchApiVideo>> {
    const params = new URLSearchParams({
        user_id: userId,
        first: String(options.first || 20),
    });

    if (options.after) {
        params.set('after', options.after);
    }
    if (options.type) {
        params.set('type', options.type);
    }

    const data = await client.request<TwitchApiResponse<TwitchApiVideo>>(
        `/videos?${params.toString()}`
    );

    return {
        data: data.data,
        cursor: data.pagination?.cursor,
    };
}
