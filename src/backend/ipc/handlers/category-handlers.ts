import { ipcMain } from 'electron';
import { Platform } from '../../../shared/auth-types';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

export function registerCategoryHandlers(): void {
    /**
     * Get top categories from one or both platforms
     */
    ipcMain.handle(IPC_CHANNELS.CATEGORIES_GET_TOP, async (_event, params: {
        platform?: Platform;
        limit?: number;
        cursor?: string;
    } = {}) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            const results: { platform: Platform; data: any[]; cursor?: string }[] = [];

            if (!params.platform || params.platform === 'twitch') {
                try {
                    const result = await twitchClient.getTopCategories({
                        first: params.limit || 20,
                        after: params.cursor,
                    });
                    results.push({ platform: 'twitch', data: result.data, cursor: result.cursor });
                } catch (err) {
                    console.warn('⚠️ Failed to fetch Twitch top categories:', err);
                }
            }

            if (!params.platform || params.platform === 'kick') {
                try {
                    const result = await kickClient.getTopCategories({
                        limit: params.limit || 20,
                    });
                    results.push({ platform: 'kick', data: result.data, cursor: result.nextPage?.toString() });
                } catch (err) {
                    console.warn('⚠️ Failed to fetch Kick top categories:', err);
                }
            }

            if (!params.platform) {
                const allCategories = results.flatMap(r => r.data);
                return { success: true, data: allCategories };
            }

            return { success: true, ...results[0] };
        } catch (error) {
            console.error('❌ Failed to get top categories:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch categories' };
        }
    });

    /**
     * Get category by ID
     */
    ipcMain.handle(IPC_CHANNELS.CATEGORIES_GET_BY_ID, async (_event, params: {
        platform: Platform;
        categoryId: string;
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            let category = null;

            if (params.platform === 'twitch') {
                category = await twitchClient.getCategoryById(params.categoryId);
            } else if (params.platform === 'kick') {
                category = await kickClient.getCategoryById(params.categoryId);
            }

            return { success: true, data: category };
        } catch (error) {
            console.error('❌ Failed to get category by ID:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch category' };
        }
    });

    /**
     * Search categories
     */
    ipcMain.handle(IPC_CHANNELS.CATEGORIES_SEARCH, async (_event, params: {
        query: string;
        platform?: Platform;
        limit?: number;
    }) => {
        const { twitchClient } = await import('../../api/platforms/twitch/twitch-client');
        const { kickClient } = await import('../../api/platforms/kick/kick-client');

        try {
            const results: { platform: Platform; data: any[] }[] = [];

            if (!params.platform || params.platform === 'twitch') {
                try {
                    const result = await twitchClient.searchCategories(params.query, {
                        first: params.limit || 20,
                    });
                    results.push({ platform: 'twitch', data: result.data });
                } catch (err) {
                    console.warn('⚠️ Failed to search Twitch categories:', err);
                }
            }

            if (!params.platform || params.platform === 'kick') {
                try {
                    const result = await kickClient.searchCategories(params.query);
                    results.push({ platform: 'kick', data: result.data });
                } catch (err) {
                    console.warn('⚠️ Failed to search Kick categories:', err);
                }
            }

            if (!params.platform) {
                const allCategories = results.flatMap(r => r.data);
                return { success: true, data: allCategories };
            }

            return { success: true, ...results[0] };
        } catch (error) {
            console.error('❌ Failed to search categories:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Search failed' };
        }
    });
}
