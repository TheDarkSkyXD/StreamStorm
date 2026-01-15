
import { TwitchGqlResponse } from './twitch-types';

const GQL_ENDPOINT = 'https://gql.twitch.tv/gql';
const GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

/**
 * Extract error code from Error or its cause.
 * Node.js fetch wraps the real error in cause property.
 */
function getErrorCode(error: unknown): string | undefined {
    if (error instanceof Error) {
        // Check cause first (Node.js fetch wraps the real error in cause)
        const cause = (error as Error & { cause?: { code?: string } }).cause;
        if (cause?.code) {
            return cause.code;
        }
        // Fall back to direct code property
        const directCode = (error as Error & { code?: string }).code;
        if (directCode) {
            return directCode;
        }
    }
    return undefined;
}

/**
 * Check if an error is retryable (transient network issues).
 * Handles ECONNRESET, ETIMEDOUT, and other socket-level failures.
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const code = getErrorCode(error);

        // Network-level errors that are typically transient
        const retryableCodes = [
            'ECONNRESET',    // Connection reset (TLS handshake failure)
            'ETIMEDOUT',     // Connection timed out
            'ENOTFOUND',     // DNS lookup failed (transient)
            'ECONNREFUSED',  // Connection refused
            'ENETUNREACH',   // Network unreachable
            'EHOSTUNREACH',  // Host unreachable
            'EPIPE',         // Broken pipe
            'EAI_AGAIN'      // DNS temporary failure
        ];

        if (code && retryableCodes.includes(code)) {
            return true;
        }

        // AbortError means our timeout triggered - retry
        if (error.name === 'AbortError') {
            return true;
        }

        // Check error message for fetch failures
        const message = error.message.toLowerCase();
        if (message.includes('fetch failed') ||
            message.includes('network') ||
            message.includes('socket') ||
            message.includes('disconnected')) {
            return true;
        }
    }
    return false;
}

/**
 * Fetch with automatic retry for transient network errors.
 * Handles ECONNRESET, ETIMEDOUT, and other socket-level failures
 * that occur during TLS handshake with gql.twitch.tv.
 */
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    timeout: number = 15000
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Retry on transient server errors
            if (response.status >= 502 && response.status <= 504) {
                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.warn(`⚠️ Twitch GQL server error ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw new Error(`GQL server error: ${response.status} after ${maxRetries + 1} attempts`);
            }

            return response;
        } catch (error) {
            lastError = error as Error;
            const isRetryable = isRetryableError(error);

            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt);
            const errorMsg = (error as Error).message || 'Unknown error';
            const errorCode = getErrorCode(error);
            console.warn(`⚠️ Twitch GQL request failed [${errorCode || 'NETWORK'}] (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms... Error: ${errorMsg}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Request failed after retries');
}

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
        const response = await fetchWithRetry(GQL_ENDPOINT, {
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
