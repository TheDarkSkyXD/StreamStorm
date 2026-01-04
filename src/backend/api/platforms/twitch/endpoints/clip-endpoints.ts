import type { TwitchRequestor } from '../twitch-requestor';
import type {
    TwitchApiResponse,
    TwitchApiClip,
    PaginationOptions,
    PaginatedResult
} from '../twitch-types';

/**
 * Get clips by broadcaster ID
 */
export async function getClipsByBroadcaster(
    client: TwitchRequestor,
    broadcasterId: string,
    options: PaginationOptions = {}
): Promise<PaginatedResult<TwitchApiClip>> {
    const params = new URLSearchParams({
        broadcaster_id: broadcasterId,
        first: String(options.first || 20),
    });

    if (options.after) {
        params.set('after', options.after);
    }

    // Time range filtering for clips
    if (options.started_at) {
        params.set('started_at', options.started_at);
    }

    if (options.ended_at) {
        params.set('ended_at', options.ended_at);
    }

    const data = await client.request<TwitchApiResponse<TwitchApiClip>>(
        `/clips?${params.toString()}`
    );

    return {
        data: data.data,
        cursor: data.pagination?.cursor,
    };
}
