
import { useQuery } from '@tanstack/react-query';
import { Platform } from '../../shared/auth-types';
import { UnifiedCategory } from '../../backend/api/unified/platform-types';

export const CATEGORY_KEYS = {
    all: ['categories'] as const,
    top: (platform?: Platform) => [...CATEGORY_KEYS.all, 'top', platform] as const,
    byId: (categoryId: string, platform: Platform) => [...CATEGORY_KEYS.all, 'id', platform, categoryId] as const,
};

export function useTopCategories(platform?: Platform) {
    return useQuery({
        queryKey: CATEGORY_KEYS.top(platform),
        queryFn: async () => {
            // OPTIMIZATION: Fetch categories AND streams in PARALLEL instead of sequentially
            // This cuts loading time roughly in half since both requests run concurrently
            const [categoriesResponse, streamsResponse] = await Promise.all([
                window.electronAPI.categories.getTop({ platform }), // No limit - fetch ALL
                window.electronAPI.streams.getTop({ platform, limit: 100 })
            ]);

            if (categoriesResponse.error) {
                throw new Error(categoriesResponse.error as unknown as string);
            }
            const categories = categoriesResponse.data as UnifiedCategory[] || [];
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

// 5. De-duplicate: Twitch-first, then ADD Kick-exclusives
            // Rule: 
            //   - Use Twitch version for any category that exists on Twitch
            //   - ADD Kick categories that DON'T exist on Twitch
            //   - Exception: Slots → prefer Kick version (better metadata)

            const categoryMap = new Map<string, UnifiedCategory>();

            // Helper to normalize category names for comparison
            const normalizeKey = (name: string): string => {
                return name.toLowerCase().trim()
                    // Handle known variations
                    .replace(/slots & casino/i, 'slots')
                    .replace(/just chatting/i, 'just-chatting');
            };

            // First pass: Add ALL Twitch categories (they take priority)
            for (const category of enrichedCategories) {
                if (category.platform === 'twitch') {
                    const key = normalizeKey(category.name);
                    categoryMap.set(key, category);
                }
            }

            // Second pass: Add Kick-EXCLUSIVE categories (not on Twitch)
            // AND override Slots with Kick version
            const slotsKey = 'slots';
            for (const category of enrichedCategories) {
                if (category.platform === 'kick') {
                    const key = normalizeKey(category.name);

                    // Slots special case: Kick has better casino game coverage
                    if (key === slotsKey) {
                        categoryMap.set(key, category);
                        continue;
                    }

                    // Only add if Twitch doesn't have this category
                    if (!categoryMap.has(key)) {
                        categoryMap.set(key, category);
                    }
                }
            }

            return Array.from(categoryMap.values())
                .sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));
        },
        // PERFORMANCE: Categories list is expensive to fetch (1500+ items)
        // Cache for 5 minutes since category list doesn't change frequently
        staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
        gcTime: 15 * 60 * 1000,   // 15 minutes - keep in cache for quick return
        // Show previous data instantly while refetching in background
        placeholderData: (previousData) => previousData,
        // Refetch when window regains focus (user may have been away)
        refetchOnWindowFocus: true,
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
