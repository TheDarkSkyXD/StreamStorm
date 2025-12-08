import type { UnifiedCategory } from '../../../unified/platform-types';
import type { TwitchRequestor } from '../twitch-requestor';
import type {
    TwitchApiResponse,
    TwitchApiGame,
    PaginationOptions,
    PaginatedResult
} from '../twitch-types';
import { transformTwitchCategory } from '../twitch-transformers';

/**
 * Get top categories/games
 */
export async function getTopCategories(
    client: TwitchRequestor,
    options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedCategory>> {
    const params = new URLSearchParams({
        first: String(options.first || 20),
    });

    if (options.after) {
        params.set('after', options.after);
    }

    const data = await client.request<TwitchApiResponse<TwitchApiGame>>(
        `/games/top?${params.toString()}`
    );

    return {
        data: data.data.map(transformTwitchCategory),
        cursor: data.pagination?.cursor,
    };
}

/**
 * Get category/game by ID
 */
export async function getCategoryById(
    client: TwitchRequestor,
    id: string
): Promise<UnifiedCategory | null> {
    const data = await client.request<TwitchApiResponse<TwitchApiGame>>(
        `/games?id=${id}`
    );

    if (data.data && data.data.length > 0) {
        return transformTwitchCategory(data.data[0]);
    }
    return null;
}
