
import { TwitchGqlResponse } from './twitch-types';

const GQL_ENDPOINT = 'https://gql.twitch.tv/gql';
const GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

export interface GqlVideoGameData {
    id: string;
    game: {
        id: string;
        displayName: string;
        name?: string; // Sometimes it's name or displayName
    } | null;
}

export async function fetchGamesForVideos(videoIds: string[]): Promise<Record<string, { id: string; name: string }>> {
    if (!videoIds.length) return {};

    // Twitch GQL doesn't support videos(ids: [...]), so we must use aliased queries
    // v12345: video(id: "12345") { ... }
    const validIds = videoIds.filter(id => /^\d+$/.test(id));
    if (!validIds.length) return {};

    const queryFields = validIds.map(id => `
        v${id}: video(id: "${id}") {
            id
            game {
                id
                displayName
                name
            }
        }
    `).join('\n');

    const query = `
        query GetVideosGameData {
            ${queryFields}
        }
    `;

    try {
        const response = await fetch(GQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Client-Id': GQL_CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            console.error('Available Twitch GQL call failed:', response.status);
            return {};
        }

        const json = await response.json() as TwitchGqlResponse<Record<string, GqlVideoGameData>>;

        if (json.errors) {
            console.error('Twitch GQL Errors:', JSON.stringify(json.errors, null, 2));
            return {};
        }

        if (!json.data) {
            console.error('Twitch GQL Response data is missing');
            return {};
        }

        const result: Record<string, { id: string; name: string }> = {};

        Object.values(json.data).forEach(videoData => {
            // videoData is the GqlVideoGameData object (or null if not found)
            // It corresponds to one of the aliased fields
            const video = videoData as unknown as { id: string; game: { id: string; displayName: string; name?: string } | null } | null;

            if (video && video.game) {
                result[video.id] = {
                    id: video.game.id,
                    name: video.game.displayName || video.game.name || ''
                };
            }
        });

        return result;

    } catch (error) {
        console.error('Failed to fetch games for videos via GQL:', error);
        return {};
    }
}
