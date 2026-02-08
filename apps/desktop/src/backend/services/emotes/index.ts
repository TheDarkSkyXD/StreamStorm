/**
 * Emote System Exports
 *
 * Central export point for all emote-related services and types.
 */

export { SevenTVEmoteProvider, sevenTVEmoteProvider } from "./7tv-emotes";
export { BTTVEmoteProvider, bttvEmoteProvider } from "./bttv-emotes";
// Manager
export { EmoteManager, emoteManager } from "./emote-manager";
// Types
export * from "./emote-types";
export { FFZEmoteProvider, ffzEmoteProvider } from "./ffz-emotes";
export { KickEmoteProvider, kickEmoteProvider } from "./kick-emotes";
// Providers
export { TwitchEmoteProvider, twitchEmoteProvider } from "./twitch-emotes";

import { sevenTVEmoteProvider } from "./7tv-emotes";
import { bttvEmoteProvider } from "./bttv-emotes";
// Initialize providers with the manager
import { emoteManager } from "./emote-manager";
import { ffzEmoteProvider } from "./ffz-emotes";
import { kickEmoteProvider } from "./kick-emotes";
import { twitchEmoteProvider } from "./twitch-emotes";

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
