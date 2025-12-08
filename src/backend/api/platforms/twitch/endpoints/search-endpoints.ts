import type { UnifiedCategory, UnifiedChannel } from '../../../unified/platform-types';
import type { TwitchRequestor } from '../twitch-requestor';
import type {
    TwitchApiResponse,
    TwitchApiSearchChannel,
    TwitchApiGame,
    PaginationOptions,
    PaginatedResult
} from '../twitch-types';
import { transformTwitchSearchChannel, transformTwitchCategory } from '../twitch-transformers';

/**
 * Search for channels
 */
export async function searchChannels(
    client: TwitchRequestor,
    query: string,
    options: PaginationOptions & { liveOnly?: boolean } = {}
): Promise<PaginatedResult<UnifiedChannel>> {
    const params = new URLSearchParams({
        query,
        first: String(options.first || 20),
    });

    if (options.after) {
        params.set('after', options.after);
    }
    if (options.liveOnly !== undefined) {
        params.set('live_only', String(options.liveOnly));
    }

    const data = await client.request<TwitchApiResponse<TwitchApiSearchChannel>>(
        `/search/channels?${params.toString()}`
    );

    // Transform search results to unified channels
    const channels: UnifiedChannel[] = data.data.map(transformTwitchSearchChannel);

    return {
        data: channels,
        cursor: data.pagination?.cursor,
    };
}

/**
 * Search for categories/games
 */
export async function searchCategories(
    client: TwitchRequestor,
    query: string,
    options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedCategory>> {
    const params = new URLSearchParams({
        query,
        first: String(options.first || 20),
    });

    if (options.after) {
        params.set('after', options.after);
    }

    const data = await client.request<TwitchApiResponse<TwitchApiGame>>(
        `/search/categories?${params.toString()}`
    );

    return {
        data: data.data.map(transformTwitchCategory),
        cursor: data.pagination?.cursor,
    };
}
