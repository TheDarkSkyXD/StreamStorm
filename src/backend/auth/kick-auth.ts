/**
 * Kick Authentication Service
 *
 * Handles Kick-specific authentication operations including:
 * - Token refresh
 * - Token revocation (logout)
 * - User info fetching
 */

import type { Platform, AuthToken, KickUser } from '../../shared/auth-types';
import { getOAuthConfig } from './oauth-config';
import { tokenExchangeService } from './token-exchange';
import { storageService } from '../services/storage-service';
import { KICK_API_BASE, type KickApiUser } from '../api/platforms/kick/kick-types';

// ========== Kick Auth Service Class ==========

class KickAuthService {
    private readonly platform: Platform = 'kick';

    /**
     * Refresh the access token using the refresh token
     */
    async refreshToken(): Promise<AuthToken | null> {
        const currentToken = storageService.getToken(this.platform);

        if (!currentToken?.refreshToken) {
            console.warn('⚠️ No refresh token available for Kick');
            return null;
        }

        try {
            const newToken = await tokenExchangeService.refreshToken({
                platform: this.platform,
                refreshToken: currentToken.refreshToken,
            });

            // Save the new token
            storageService.saveToken(this.platform, newToken);

            console.log('✅ Kick token refreshed successfully');
            return newToken;
        } catch (error) {
            console.error('❌ Kick token refresh failed:', error);
            return null;
        }
    }

    /**
     * Check if token needs refresh and refresh if necessary
     */
    async ensureValidToken(): Promise<boolean> {
        const token = storageService.getToken(this.platform);

        if (!token) {
            return false;
        }

        const expiresAt = token.expiresAt ?? 0;
        const expirationBuffer = 5 * 60 * 1000; // 5 minutes

        if (expiresAt > 0 && Date.now() >= expiresAt - expirationBuffer) {
            console.log('🔄 Kick token expired or expiring soon, refreshing...');
            const refreshed = await this.refreshToken();
            return refreshed !== null;
        }

        return true;
    }

    /**
     * Logout and clear local data
     */
    async logout(): Promise<boolean> {
        // Kick might not have a formal revoke endpoint, so we just clear local data
        storageService.clearToken(this.platform);
        storageService.clearKickUser();


        return true;
    }

    /**
     * Fetch the current authenticated user's information
     * Uses the official Kick Dev API: GET /users returns current user when no IDs specified
     */
    async fetchCurrentUser(accessToken?: string): Promise<KickUser | null> {
        const token = accessToken ?? storageService.getToken(this.platform)?.accessToken;

        if (!token) {
            console.warn('⚠️ No access token available for fetching user');
            return null;
        }

        try {
            // Official Kick API endpoint: GET /users returns current user info
            const response = await fetch(`${KICK_API_BASE}/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.log('🔄 Token expired, attempting refresh...');
                    const refreshed = await this.refreshToken();
                    if (refreshed) {
                        return this.fetchCurrentUser(refreshed.accessToken);
                    }
                }
                throw new Error(`Failed to fetch user: ${response.status}`);
            }

            // Official API response format: { data: [{ user_id, name, email, profile_picture }], message: "..." }
            const responseData = (await response.json()) as {
                data: Array<{
                    user_id: number;
                    name: string;
                    email?: string;
                    profile_picture?: string;
                }>;
                message?: string;
            };

            // Log the raw response for debugging
            console.log('📥 Kick API /users response:', JSON.stringify(responseData, null, 2));

            if (!responseData.data || responseData.data.length === 0) {
                console.warn('⚠️ No user data returned from Kick API');
                return null;
            }

            const apiUser = responseData.data[0];
            console.log('📥 Kick user data:', {
                user_id: apiUser.user_id,
                name: apiUser.name,
                profile_picture: apiUser.profile_picture,
            });

            const user = this.transformApiUser(apiUser);

            // Update stored user data
            storageService.saveKickUser(user);

            console.log('✅ Kick user fetched successfully:', user.username, 'Profile pic:', user.profilePic || '(none)');
            return user;
        } catch (error) {
            console.error('❌ Failed to fetch Kick user:', error);
            return null;
        }
    }

    /**
     * Transform official Kick API user response to our KickUser format
     */
    private transformApiUser(apiUser: {
        user_id: number;
        name: string;
        email?: string;
        profile_picture?: string;
    }): KickUser {
        return {
            id: apiUser.user_id,
            username: apiUser.name,
            slug: apiUser.name.toLowerCase().replace(/\s+/g, '-'), // Derive slug from name
            verified: !!apiUser.email, // If email is present, user is likely verified
            email: apiUser.email,
            profilePic: apiUser.profile_picture || '',
            // These fields might not be available from official API
            bio: undefined,
            twitter: undefined,
            discord: undefined,
            instagram: undefined,
            youtube: undefined,
            tiktok: undefined,
            facebook: undefined,
        };
    }

    /**
     * Transform Kick API user to our KickUser format
     */
    private transformUser(apiUser: KickApiUser): KickUser {
        return {
            id: apiUser.id,
            username: apiUser.username,
            slug: apiUser.id.toString(), // Kick doesn't always provide slug in user me endpoint, use id as fallback or it might be in 'slug' field if available. Let's assume we map it from somewhere or default. Actually, looking at types, apiUser usually has slug or username is slug. Let's use username as slug fallback.
            verified: apiUser.email_verified_at !== null,
            email: apiUser.email_verified_at ? 'verified@hidden.com' : undefined, // Kick API often hides email
            profilePic: apiUser.profile_pic || '',
            bio: apiUser.bio || undefined,
            twitter: apiUser.twitter || undefined,
            discord: apiUser.discord || undefined,
            instagram: apiUser.instagram || undefined,
            youtube: apiUser.youtube || undefined,
            tiktok: apiUser.tiktok || undefined,
            facebook: apiUser.facebook || undefined
        };
    }

    /**
     * Check if the user is currently authenticated with Kick
     */
    isAuthenticated(): boolean {
        const token = storageService.getToken(this.platform);
        const user = storageService.getKickUser();
        return !!token && !!user;
    }

    /**
     * Get the current authenticated user (from storage)
     */
    getCurrentUser(): KickUser | null {
        return storageService.getKickUser();
    }

    /**
     * Get the current access token (if valid)
     */
    getAccessToken(): string | null {
        const token = storageService.getToken(this.platform);
        if (!token) return null;

        // Check if expired
        if (token.expiresAt && Date.now() >= token.expiresAt) {
            return null;
        }

        return token.accessToken;
    }
}

export const kickAuthService = new KickAuthService();
