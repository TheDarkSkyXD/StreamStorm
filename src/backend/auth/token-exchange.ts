/**
 * Token Exchange Utility
 *
 * Handles the OAuth token exchange process - exchanging
 * authorization codes for access tokens and handling token refresh.
 */

import type { Platform, AuthToken } from '../../shared/auth-types';
import { getOAuthConfig, type PkceChallenge } from './oauth-config';

// ========== Types ==========

export interface TokenExchangeParams {
    platform: Platform;
    code: string;
    redirectUri: string; // Required - the redirect URI used for the OAuth flow
    pkce: PkceChallenge;
}

export interface TokenRefreshParams {
    platform: Platform;
    refreshToken: string;
}

export interface TokenRevokeParams {
    platform: Platform;
    token: string;
}

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    scope?: string | string[]; // Can be array or space-separated string
}


interface TokenError {
    error: string;
    error_description?: string;
    message?: string;
}

// ========== Token Exchange Class ==========

class TokenExchangeService {
    /**
     * Exchange an authorization code for an access token
     */
    async exchangeCodeForToken(params: TokenExchangeParams): Promise<AuthToken> {
        const config = getOAuthConfig(params.platform);

        console.debug(`🔄 Exchanging code for token (${params.platform})`);
        console.debug(`📤 Token endpoint: ${config.tokenEndpoint}`);
        console.debug(`📤 Client ID: ${config.clientId ? config.clientId.substring(0, 8) + '...' : 'NOT SET'}`);
        console.debug(`📤 Redirect URI: ${params.redirectUri}`);
        console.debug(`📤 Code: ${params.code.substring(0, 10)}...`);
        console.debug(`📤 PKCE enabled: ${config.usesPkce}`);

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: params.redirectUri,
            code: params.code,
        });

        // Add PKCE code verifier if used
        if (config.usesPkce && params.pkce) {
            console.debug(`📤 Code verifier: ${params.pkce.codeVerifier.substring(0, 10)}...`);
            body.append('code_verifier', params.pkce.codeVerifier);
        }


        try {
            const response = await fetch(config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as TokenError;
                const errorMessage =
                    errorData.error_description ||
                    errorData.message ||
                    errorData.error ||
                    'Token exchange failed';
                console.error(
                    `❌ Token exchange failed for ${params.platform}:`,
                    response.status,
                    errorMessage
                );
                throw new Error(errorMessage);
            }

            const data = (await response.json()) as TokenResponse;
            const token = this.parseTokenResponse(data);

            console.debug(`✅ Token obtained for ${params.platform}`);
            return token;
        } catch (error) {
            console.error(`❌ Token exchange error for ${params.platform}:`, error);
            throw error;
        }
    }

    /**
     * Get an App Access Token (Client Credentials Flow)
     */
    async getAppAccessToken(platform: Platform): Promise<AuthToken> {
        const config = getOAuthConfig(platform);

        console.debug(`🔄 Getting App Access Token for ${platform}`);

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.clientId,
            client_secret: config.clientSecret,
        });

        try {
            const response = await fetch(config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as TokenError;
                const errorMessage =
                    errorData.error_description ||
                    errorData.message ||
                    errorData.error ||
                    'App token exchange failed';
                console.error(
                    `❌ App token exchange failed for ${platform}:`,
                    response.status,
                    errorMessage
                );
                throw new Error(errorMessage);
            }

            const data = (await response.json()) as TokenResponse;
            const token = this.parseTokenResponse(data);

            console.debug(`✅ App Token obtained for ${platform}`);
            return token;
        } catch (error) {
            console.error(`❌ App token exchange error for ${platform}:`, error);
            throw error;
        }
    }

    /**
     * Refresh an access token using a refresh token
     */
    async refreshToken(params: TokenRefreshParams): Promise<AuthToken> {
        const config = getOAuthConfig(params.platform);

        console.debug(`🔄 Refreshing token for ${params.platform}`);

        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: params.refreshToken,
        });

        try {
            const response = await fetch(config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as TokenError;
                const errorMessage =
                    errorData.error_description ||
                    errorData.message ||
                    errorData.error ||
                    'Token refresh failed';
                console.error(
                    `❌ Token refresh failed for ${params.platform}:`,
                    response.status,
                    errorMessage
                );
                throw new Error(errorMessage);
            }

            const data = (await response.json()) as TokenResponse;
            const token = this.parseTokenResponse(data);

            console.debug(`✅ Token refreshed for ${params.platform}`);
            return token;
        } catch (error) {
            console.error(`❌ Token refresh error for ${params.platform}:`, error);
            throw error;
        }
    }

    /**
     * Revoke an access token
     */
    async revokeToken(params: TokenRevokeParams): Promise<boolean> {
        const config = getOAuthConfig(params.platform);

        if (!config.revokeEndpoint) {
            console.warn(`⚠️ No revoke endpoint for ${params.platform}`);
            return false;
        }

        console.debug(`🗑️ Revoking token for ${params.platform}`);

        const body = new URLSearchParams({
            client_id: config.clientId,
            token: params.token,
        });

        try {
            const response = await fetch(config.revokeEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                console.warn(
                    `⚠️ Token revocation returned non-OK status for ${params.platform}:`,
                    response.status
                );
                // Revocation often returns 200 OK even if token was already invalid
                // So we don't throw here, just warn
            }

            console.debug(`✅ Token revoked for ${params.platform}`);
            return true;
        } catch (error) {
            console.error(`❌ Token revocation error for ${params.platform}:`, error);
            return false;
        }
    }

    /**
     * Parse the token response into our AuthToken format
     */
    private parseTokenResponse(data: TokenResponse): AuthToken {
        const token: AuthToken = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
        };

        // Calculate expiration time if expires_in is provided
        if (data.expires_in) {
            token.expiresAt = Date.now() + data.expires_in * 1000;
        }

        // Parse scope if provided - handle both array and string formats
        if (data.scope) {
            if (Array.isArray(data.scope)) {
                token.scope = data.scope;
            } else if (typeof data.scope === 'string') {
                token.scope = data.scope.split(' ');
            }
        }

        return token;
    }


    /**
     * Validate a token by making a request to the platform's user info endpoint
     * Returns true if the token is valid
     */
    async validateToken(platform: Platform, accessToken: string): Promise<boolean> {
        try {
            switch (platform) {
                case 'twitch':
                    return await this.validateTwitchToken(accessToken);
                case 'kick':
                    return await this.validateKickToken(accessToken);
                default:
                    return false;
            }
        } catch {
            return false;
        }
    }

    /**
     * Validate a Twitch token
     */
    private async validateTwitchToken(accessToken: string): Promise<boolean> {
        const response = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: {
                Authorization: `OAuth ${accessToken}`,
            },
        });
        return response.ok;
    }

    /**
     * Validate a Kick token using the official token introspection endpoint
     * POST /public/v1/token/introspect
     */
    private async validateKickToken(accessToken: string): Promise<boolean> {
        try {
            // Official Kick token introspection endpoint
            const response = await fetch('https://api.kick.com/public/v1/token/introspect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                return false;
            }

            // Response format: { data: { active: true/false, ... }, message: "..." }
            const data = (await response.json()) as { data: { active: boolean } };
            return data?.data?.active === true;
        } catch {
            return false;
        }
    }
}

// ========== Export Singleton ==========

export const tokenExchangeService = new TokenExchangeService();
