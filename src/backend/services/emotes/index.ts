/**
 * Emote System Exports
 *
 * Central export point for all emote-related services and types.
 */

// Types
export * from './emote-types';

// Manager
export { emoteManager, EmoteManager } from './emote-manager';

// Providers
export { twitchEmoteProvider, TwitchEmoteProvider } from './twitch-emotes';
export { kickEmoteProvider, KickEmoteProvider } from './kick-emotes';
export { bttvEmoteProvider, BTTVEmoteProvider } from './bttv-emotes';
export { ffzEmoteProvider, FFZEmoteProvider } from './ffz-emotes';
export { sevenTVEmoteProvider, SevenTVEmoteProvider } from './7tv-emotes';

// Initialize providers with the manager
import { emoteManager } from './emote-manager';
import { twitchEmoteProvider } from './twitch-emotes';
import { kickEmoteProvider } from './kick-emotes';
import { bttvEmoteProvider } from './bttv-emotes';
import { ffzEmoteProvider } from './ffz-emotes';
import { sevenTVEmoteProvider } from './7tv-emotes';

/**
 * Register all emote providers with the manager
 * Call this during app initialization
 */
export function initializeEmoteProviders(): void {
    emoteManager.registerProvider(twitchEmoteProvider);
    emoteManager.registerProvider(kickEmoteProvider);
    emoteManager.registerProvider(bttvEmoteProvider);
    emoteManager.registerProvider(ffzEmoteProvider);
    emoteManager.registerProvider(sevenTVEmoteProvider);
}

/**
 * Configure Twitch provider with credentials and initialize
 * @param clientId - Twitch Client ID
 * @param accessToken - Twitch OAuth access token
 */
export async function initializeTwitchEmotes(clientId: string, accessToken: string): Promise<void> {
    twitchEmoteProvider.configure(clientId, accessToken);
}

/**
 * Configure Kick provider with credentials
 * @param accessToken - Kick OAuth access token
 */
export function initializeKickEmotes(accessToken: string): void {
    kickEmoteProvider.configure(accessToken);
}
