/**
 * Preload Script
 *
 * This script runs in a privileged context and exposes a safe API
 * to the renderer process via contextBridge.
 *
 * Security: Only expose necessary functions, never expose ipcRenderer directly.
 */

import { contextBridge, ipcRenderer } from 'electron';

import type {
  Platform,
  AuthToken,
  LocalFollow,
  UserPreferences,
  TwitchUser,
  KickUser,
} from '../shared/auth-types';
import { IPC_CHANNELS, AuthStatus } from '../shared/ipc-channels';

// Define the API exposed to the renderer
const electronAPI = {
  // ========== App Info ==========
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  getName: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_NAME),

  // ========== Window Controls ==========
  minimizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  onMaximizeChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, handler);
  },

  // ========== Theme ==========
  getSystemTheme: (): Promise<'light' | 'dark'> => ipcRenderer.invoke(IPC_CHANNELS.THEME_GET_SYSTEM),

  // ========== Generic Storage (deprecated) ==========
  store: {
    get: <T>(key: string): Promise<T | null> => ipcRenderer.invoke(IPC_CHANNELS.STORE_GET, { key }),
    set: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.STORE_SET, { key, value }),
    delete: (key: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.STORE_DELETE, { key }),
  },

  // ========== Auth - OAuth Flow ==========
  auth: {
    // Open OAuth login windows - throws if OAuth fails or is not configured
    openTwitchLogin: async (): Promise<void> => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.AUTH_OPEN_TWITCH) as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Twitch login failed');
      }
    },
    openKickLogin: async (): Promise<void> => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.AUTH_OPEN_KICK) as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Kick login failed');
      }
    },

    // Device Code Flow (Twitch) - for desktop apps without redirect URI
    startDeviceCodeFlow: async (): Promise<{
      userCode: string;
      verificationUri: string;
      deviceCode: string;
      expiresIn: number;
      interval: number;
    }> => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.AUTH_DCF_START) as {
        success: boolean;
        error?: string;
        userCode?: string;
        verificationUri?: string;
        deviceCode?: string;
        expiresIn?: number;
        interval?: number;
      };
      if (!result.success) {
        throw new Error(result.error || 'Failed to start device code flow');
      }
      return {
        userCode: result.userCode!,
        verificationUri: result.verificationUri!,
        deviceCode: result.deviceCode!,
        expiresIn: result.expiresIn!,
        interval: result.interval!,
      };
    },
    pollDeviceCode: async (deviceCode: string, interval: number, expiresIn: number): Promise<void> => {
      const result = await ipcRenderer.invoke(IPC_CHANNELS.AUTH_DCF_POLL, { deviceCode, interval, expiresIn }) as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Device code polling failed');
      }
    },
    cancelDeviceCodeFlow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_DCF_CANCEL),
    onDeviceCodeStatus: (callback: (data: { status: string; message?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { status: string; message?: string }) =>
        callback(data);
      ipcRenderer.on(IPC_CHANNELS.AUTH_DCF_STATUS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTH_DCF_STATUS, handler);
    },

    // Listen for OAuth callback
    onCallback: (callback: (data: { platform: string; success: boolean; error?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { platform: string; success: boolean; error?: string }) =>
        callback(data);
      ipcRenderer.on(IPC_CHANNELS.AUTH_ON_CALLBACK, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTH_ON_CALLBACK, handler);
    },


    // Token management
    getToken: (platform: Platform): Promise<AuthToken | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_TOKEN, { platform }),
    saveToken: (platform: Platform, token: AuthToken): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_SAVE_TOKEN, { platform, token }),
    clearToken: (platform: Platform): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_CLEAR_TOKEN, { platform }),
    hasToken: (platform: Platform): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_HAS_TOKEN, { platform }),
    isTokenExpired: (platform: Platform): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_IS_TOKEN_EXPIRED, { platform }),
    clearAllTokens: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CLEAR_ALL_TOKENS),

    // User data - Twitch
    getTwitchUser: (): Promise<TwitchUser | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_TWITCH_USER),
    saveTwitchUser: (user: TwitchUser): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_SAVE_TWITCH_USER, { user }),
    clearTwitchUser: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CLEAR_TWITCH_USER),

    // User data - Kick
    getKickUser: (): Promise<KickUser | null> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_KICK_USER),
    saveKickUser: (user: KickUser): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_SAVE_KICK_USER, { user }),
    clearKickUser: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CLEAR_KICK_USER),

    // Twitch operations
    logoutTwitch: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT_TWITCH),
    refreshTwitchToken: (): Promise<{ success: boolean; token?: AuthToken; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REFRESH_TWITCH),
    fetchTwitchUser: (): Promise<{ success: boolean; user?: TwitchUser; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_FETCH_TWITCH_USER),

    // Kick operations
    logoutKick: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT_KICK),
    fetchKickUser: (): Promise<{ success: boolean; user?: KickUser; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_FETCH_KICK_USER),

    // Auth status
    getStatus: (): Promise<AuthStatus> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_STATUS),
  },

  // ========== Local Follows ==========
  follows: {
    getAll: (): Promise<LocalFollow[]> => ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_GET_ALL),
    getByPlatform: (platform: Platform): Promise<LocalFollow[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_GET_BY_PLATFORM, { platform }),
    add: (follow: Omit<LocalFollow, 'id' | 'followedAt'>): Promise<LocalFollow> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_ADD, { follow }),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_REMOVE, { id }),
    update: (id: string, updates: Partial<LocalFollow>): Promise<LocalFollow | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_UPDATE, { id, updates }),
    isFollowing: (platform: Platform, channelId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_IS_FOLLOWING, { platform, channelId }),
    import: (follows: LocalFollow[]): Promise<number> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_IMPORT, { follows }),
    clear: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.FOLLOWS_CLEAR),
  },

  // ========== User Preferences ==========
  preferences: {
    get: (): Promise<UserPreferences> => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET),
    update: (updates: Partial<UserPreferences>): Promise<UserPreferences> =>
      ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_UPDATE, { updates }),
    reset: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_RESET),
  },

  // ========== External Links ==========
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, { url }),

  // ========== Notifications ==========
  showNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SHOW, { title, body }),

  // ========== Image Proxy (CORS bypass) ==========
  proxyImage: (url: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_PROXY, { url }),
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the exposed API
export type ElectronAPI = typeof electronAPI;
