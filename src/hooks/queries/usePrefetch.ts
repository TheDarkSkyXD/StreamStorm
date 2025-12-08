
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Platform } from '../../shared/auth-types';
import { STREAM_KEYS } from './useStreams';
import { CATEGORY_KEYS } from './useCategories';
import { UnifiedStream, UnifiedCategory } from '../../backend/api/unified/platform-types';

export function usePrefetchChannel() {
    const queryClient = useQueryClient();

    const prefetchChannel = useCallback((username: string, platform: Platform) => {
        queryClient.prefetchQuery({
            queryKey: STREAM_KEYS.byChannel(username, platform),
            queryFn: async () => {
                const response = await window.electronAPI.streams.getByChannel({ username, platform });
                if (response.error) {
                    throw new Error(response.error as unknown as string);
                }
                return response.data as UnifiedStream;
            },
            staleTime: 30 * 1000, // 30s
        });
    }, [queryClient]);

    return prefetchChannel;
}

export function usePrefetchCategory() {
    const queryClient = useQueryClient();

    const prefetchCategory = useCallback((categoryId: string, platform: Platform) => {
        queryClient.prefetchQuery({
            queryKey: CATEGORY_KEYS.byId(categoryId, platform),
            queryFn: async () => {
                const response = await window.electronAPI.categories.getById({ categoryId, platform });
                if (response.error) {
                    throw new Error(response.error as unknown as string);
                }
                return response.data as UnifiedCategory;
            },
            staleTime: 60 * 1000, // 1m for categories
        });
    }, [queryClient]);

    return prefetchCategory;
}
