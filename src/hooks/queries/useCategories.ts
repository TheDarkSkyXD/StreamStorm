
import { useQuery } from '@tanstack/react-query';
import { Platform } from '../../shared/auth-types';
import { UnifiedCategory } from '../../backend/api/unified/platform-types';

export const CATEGORY_KEYS = {
    all: ['categories'] as const,
    top: (platform?: Platform, limit?: number) => [...CATEGORY_KEYS.all, 'top', platform, limit] as const,
    byId: (categoryId: string, platform: Platform) => [...CATEGORY_KEYS.all, 'id', platform, categoryId] as const,
};

export function useTopCategories(platform?: Platform, limit: number = 20) {
    return useQuery({
        queryKey: CATEGORY_KEYS.top(platform, limit),
        queryFn: async () => {
            // 1. Fetch categories
            const categoriesResponse = await window.electronAPI.categories.getTop({ platform, limit });
            if (categoriesResponse.error) {
                throw new Error(categoriesResponse.error as unknown as string);
            }
            const categories = categoriesResponse.data as UnifiedCategory[] || [];

            // 2. Fetch top streams to aggregate viewer counts (approximation)
            // We fetch 100 streams to get a decent sample of active games
            const streamsResponse = await window.electronAPI.streams.getTop({ platform, limit: 100 });
            const streams = (streamsResponse.data as any[]) || [];

            // 3. Aggregate viewer counts by category ID
            const viewerCounts = new Map<string, number>();
            streams.forEach(stream => {
                const categoryId = stream.categoryId;
                const viewers = stream.viewerCount || 0;
                if (categoryId) {
                    viewerCounts.set(categoryId, (viewerCounts.get(categoryId) || 0) + viewers);
                }
            });

            // 4. Enrich categories with viewer counts
            const enrichedCategories = categories.map(category => ({
                ...category,
                viewerCount: Math.max(
                    viewerCounts.get(category.id) || 0,
                    category.viewerCount || 0
                )
            }));

            // 5. De-duplicate and prioritize
            // Rule: Use Twitch for EVERYTHING.
            // Exception: Use Kick ONLY for 'Slots' (Slots & Casino).

            const categoryMap = new Map<string, UnifiedCategory>();
            const slotsKey = '@@slots@@';

            // First pass: Identify Kick Slots if it exists
            const kickSlots = enrichedCategories.find(c =>
                c.platform === 'kick' &&
                (c.name.toLowerCase().trim() === 'slots' || c.name.toLowerCase().trim() === 'slots & casino')
            );

            for (const category of enrichedCategories) {
                // Normalize key
                let key = category.name.toLowerCase().trim();
                if (key === 'slots' || key === 'slots & casino') {
                    key = slotsKey;
                }

                if (key === slotsKey) {
                    // For Slots, we ALWAYS want the Kick version if we found it.
                    // If we have Kick slots, we insert it (once).
                    // If we encounter Twitch slots, we ignore it if we have Kick slots.
                    if (kickSlots) {
                        categoryMap.set(key, kickSlots);
                    } else if (category.platform === 'twitch') {
                        // Fallback to Twitch slots only if Kick slots missing
                        categoryMap.set(key, category);
                    }
                } else {
                    // For non-Slots, strictly use Twitch.
                    // Ignore all Kick categories.
                    if (category.platform === 'twitch') {
                        categoryMap.set(key, category);
                    }
                }
            }

            return Array.from(categoryMap.values())
                .sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));
        },
    });
}

export function useCategoryById(categoryId: string, platform: Platform) {
    return useQuery({
        queryKey: CATEGORY_KEYS.byId(categoryId, platform),
        queryFn: async () => {
            const response = await window.electronAPI.categories.getById({ categoryId, platform });
            if (response.error) {
                throw new Error(response.error as unknown as string);
            }
            return response.data as UnifiedCategory;
        },
        enabled: !!categoryId && !!platform,
    });
}
