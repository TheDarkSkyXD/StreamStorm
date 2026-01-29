import { getOAuthConfig } from '../../../auth/oauth-config';
import { twitchAuthService } from '../../../auth/twitch-auth';
import { storageService } from '../../../services/storage-service';

import {
    TWITCH_API_BASE,
    TwitchClientError,
} from './twitch-types';

export class TwitchRequestor {
    private readonly baseUrl = TWITCH_API_BASE;
    private config = getOAuthConfig('twitch');

    /**
     * Make an authenticated request to the Twitch API
     */
    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        // Ensure we have a valid token (User or App)
        let accessToken: string | undefined;

        // 1. Try User Token first
        const hasUserToken = await twitchAuthService.ensureValidToken();
        if (hasUserToken) {
            const userToken = storageService.getToken('twitch');
            if (userToken) {
                accessToken = userToken.accessToken;
            }
        }

        // 2. Fallback to App Token if no User Token
        if (!accessToken) {
            const hasAppToken = await twitchAuthService.ensureAppToken();
            if (hasAppToken) {
                const appToken = storageService.getAppToken('twitch');
                if (appToken) {
                    accessToken = appToken.accessToken;
                }
            }
        }

        if (!accessToken) {
            throw new Error('Not authenticated with Twitch (no valid User or App token)');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Client-Id': this.config.clientId,
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
                const error: TwitchClientError = {
                    status: 429,
                    message: 'Rate limited by Twitch API',
                    retryAfter,
                };
                console.warn(`⚠️ Twitch API rate limited, retry after ${retryAfter}s`);
                throw error;
            }

            // Handle unauthorized (try token refresh)
            if (response.status === 401) {
                console.debug('🔄 Token expired, refreshing...');
                const refreshed = await twitchAuthService.refreshToken();
                if (refreshed) {
                    // Retry the request with new token
                    return this.request<T>(endpoint, options);
                }
                throw new Error('Authentication failed');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    (errorData as { message?: string }).message ||
                    `Twitch API error: ${response.status}`
                );
            }

            return (await response.json()) as T;
        } catch (error) {
            console.error(`❌ Twitch API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * Check if the client is authenticated
     */
    isAuthenticated(): boolean {
        return twitchAuthService.isAuthenticated();
    }

    /**
     * Get the current access token
     */
    getAccessToken(): string | null {
        return twitchAuthService.getAccessToken();
    }
}
