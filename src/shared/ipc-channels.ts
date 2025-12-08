/**
 * IPC Channel Definitions
 * 
 * Type-safe IPC channel names shared between main and renderer processes.
 * All IPC communication should use these constants.
 */

export const IPC_CHANNELS = {
  // App lifecycle
  APP_GET_VERSION: 'app:get-version',
  APP_GET_NAME: 'app:get-name',
  APP_QUIT: 'app:quit',
  APP_RELAUNCH: 'app:relaunch',

  // Window management
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_ON_MAXIMIZE_CHANGE: 'window:on-maximize-change',

  // Theme
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  THEME_GET_SYSTEM: 'theme:get-system',

  // Settings/Storage
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',
  STORE_DELETE: 'store:delete',

  // Auth
  AUTH_OPEN_TWITCH: 'auth:open-twitch',
  AUTH_OPEN_KICK: 'auth:open-kick',
  AUTH_GET_TOKENS: 'auth:get-tokens',
  AUTH_SAVE_TOKENS: 'auth:save-tokens',
  AUTH_CLEAR_TOKENS: 'auth:clear-tokens',
  AUTH_ON_CALLBACK: 'auth:on-callback',

  // External links
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Notifications
  NOTIFICATION_SHOW: 'notification:show',
} as const;

// Type for channel names
export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// Payload types for IPC calls
export interface IpcPayloads {
  [IPC_CHANNELS.STORE_GET]: { key: string };
  [IPC_CHANNELS.STORE_SET]: { key: string; value: unknown };
  [IPC_CHANNELS.STORE_DELETE]: { key: string };
  [IPC_CHANNELS.THEME_SET]: { theme: 'light' | 'dark' | 'system' };
  [IPC_CHANNELS.SHELL_OPEN_EXTERNAL]: { url: string };
  [IPC_CHANNELS.NOTIFICATION_SHOW]: { title: string; body: string };
  [IPC_CHANNELS.AUTH_SAVE_TOKENS]: { platform: 'twitch' | 'kick'; tokens: AuthTokens };
}

// Auth token structure
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}
