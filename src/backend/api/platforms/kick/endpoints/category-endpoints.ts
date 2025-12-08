import { KickRequestor } from '../kick-requestor';
import { UnifiedCategory } from '../../../unified/platform-types';
import {
    KickApiResponse,
    KickApiCategory,
    KickApiLivestream,
    PaginationOptions,
    PaginatedResult
} from '../kick-types';
import { transformKickCategory } from '../kick-transformers';
import { getTopStreams } from './stream-endpoints';

/**
 * Get top/popular categories (derived from top streams)
 * Note: Kick official API doesn't have a "browse all" endpoint, so we aggregate from streams
 */
export async function getTopCategories(
    client: KickRequestor,
    options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedCategory>> {
    // We don't necessarily need auth to fetch public streams, but the client structure checks it.
    if (!client.isAuthenticated()) {
        console.warn('⚠️ Kick API requires authentication for categories');
        return { data: [] };
    }

    try {
        // Fetch a decent number of streams to get a good spread of categories
        // Limit 100 is usually the max for most APIs, we can try fetching 100.
        const streamsResult = await getTopStreams(client, { limit: 100 });
        const streams = streamsResult.data;

        // Extract unique categories
        const categoryMap = new Map<string, UnifiedCategory>();

        for (const stream of streams) {
            if (stream.categoryId && stream.categoryName) {
                // Use categoryId as key
                if (!categoryMap.has(stream.categoryId)) {
                    categoryMap.set(stream.categoryId, {
                        id: stream.categoryId,
                        platform: 'kick',
                        name: stream.categoryName,
                        boxArtUrl: '', // Will update below
                    });
                }
            }
        }

        // To get Box Art, we should probably do a raw fetch of streams here to access the 'category' object fully.
        // Duplicate logic from getTopStreams but specifically for category extraction.

        const params = new URLSearchParams();
        params.set('limit', '100');
        params.set('sort', 'viewer_count');

        const response = await client.request<KickApiResponse<KickApiLivestream[]>>(`/livestreams?${params.toString()}`);
        const rawStreams = response.data || [];

        const distinctCategories = new Map<number, UnifiedCategory>();

        for (const s of rawStreams) {
            if (s.category && !distinctCategories.has(s.category.id)) {
                distinctCategories.set(s.category.id, {
                    id: s.category.id.toString(),
                    platform: 'kick',
                    name: s.category.name,
                    boxArtUrl: s.category.thumbnail || '',
                    viewerCount: 0 // Will aggregate below
                });
            }

            // Aggregate viewer counts from these top streams
            if (s.category && distinctCategories.has(s.category.id)) {
                const cat = distinctCategories.get(s.category.id)!;
                cat.viewerCount = (cat.viewerCount || 0) + s.viewer_count;
            }
        }

        const categories = Array.from(distinctCategories.values())
            .sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));

        return {
            data: categories,
            // No real cursor for this derived list unless we implement complex pagination logic
        };

    } catch (error) {
        console.error('Failed to fetch Kick top categories:', error);
        return { data: [] };
    }
}

/**
 * Search for categories
 * https://docs.kick.com/apis/categories - GET /public/v1/categories?q=:query
 */
export async function searchCategories(
    client: KickRequestor,
    query: string,
    options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedCategory>> {
    if (!client.isAuthenticated()) {
        return { data: [] };
    }

    try {
        const params = new URLSearchParams({
            q: query,
        });
        if (options.page) {
            params.set('page', options.page.toString());
        }

        const response = await client.request<KickApiResponse<KickApiCategory[]>>(
            `/categories?${params.toString()}`
        );

        const categories = (response.data || []).map(transformKickCategory);

        return {
            data: categories,
            nextPage: categories.length >= 100 ? (options.page || 1) + 1 : undefined,
        };
    } catch (error) {
        console.error('Failed to search Kick categories:', error);
        return { data: [] };
    }
}

/**
 * Get category by ID
 * https://docs.kick.com/apis/categories - GET /public/v1/categories/:category_id
 */
export async function getCategoryById(client: KickRequestor, id: string): Promise<UnifiedCategory | null> {
    if (!client.isAuthenticated()) {
        return null;
    }

    try {
        const response = await client.request<KickApiResponse<KickApiCategory>>(
            `/categories/${id}`
        );

        if (response.data) {
            return transformKickCategory(response.data);
        }
        return null;
    } catch (error) {
        console.error('Failed to fetch Kick category:', error);
        return null;
    }
}
