/**
 * Auth Module Index
 *
 * Exports all authentication-related services and utilities.
 */

// OAuth Configuration
export {
    PROTOCOL_SCHEME,
    PROTOCOL_PREFIX,
    TWITCH_OAUTH_CONFIG,
    KICK_OAUTH_CONFIG,
    getOAuthConfig,
    generateCodeVerifier,
    generateCodeChallenge,
    generatePkceChallenge,
    buildAuthorizationUrl,
    generateState,
    validateOAuthConfig,
    isOAuthConfigured,
    getRedirectUri,
    DEFAULT_CALLBACK_PORT,
    type OAuthConfig,
    type PkceChallenge,
    type AuthUrlParams,
} from './oauth-config';

// OAuth Callback Server (localhost HTTP server for OAuth callbacks)
export {
    oauthCallbackServer,
    type OAuthCallbackResult,
    type CallbackServerOptions,
} from './oauth-callback-server';

// Protocol Handler (for custom protocol - fallback)
export {
    protocolHandler,
    type OAuthCallback,
    type OAuthCallbackHandler,
} from './protocol-handler';

// Auth Window Manager
export {
    authWindowManager,
    type AuthSession,
    type OpenAuthWindowResult,
    type OpenAuthWindowOptions,
} from './auth-window';

// Token Exchange
export {
    tokenExchangeService,
    type TokenExchangeParams,
    type TokenRefreshParams,
    type TokenRevokeParams,
} from './token-exchange';

// Twitch Auth Service
export {
    twitchAuthService,
    type TwitchAuthSession,
} from './twitch-auth';

// Kick Auth Service
export {
    kickAuthService,
} from './kick-auth';

// Device Code Flow (for Twitch - no redirect URI needed)
export {
    deviceCodeFlowService,
    type DeviceCodeResult,
} from './device-code-flow';

