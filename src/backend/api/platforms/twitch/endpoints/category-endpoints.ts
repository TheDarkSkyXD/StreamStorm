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

/**
 * Get categories/games by multiple IDs
 */
export async function getCategoriesByIds(
    client: TwitchRequestor,
    ids: string[]
): Promise<UnifiedCategory[]> {
    if (ids.length === 0) return [];

    // Twitch API supports up to 100 IDs per request
    // For now, assuming we won't exceed this for a single page of clips (12 clips)
    // If we do, we might need chunking, but for this use case it's fine.

    // Construct query string with multiple id parameters
    const params = new URLSearchParams();
    ids.forEach(id => params.append('id', id));

    const data = await client.request<TwitchApiResponse<TwitchApiGame>>(
        `/games?${params.toString()}`
    );

    if (data.data) {
        return data.data.map(transformTwitchCategory);
    }
    return [];
}
