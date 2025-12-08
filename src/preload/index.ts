/**
 * Preload Script
 * 
 * This script runs in a privileged context and exposes a safe API
 * to the renderer process via contextBridge.
 * 
 * Security: Only expose necessary functions, never expose ipcRenderer directly.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

// Define the API exposed to the renderer
const electronAPI = {
  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  getName: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_NAME),

  // Window controls
  minimizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  onMaximizeChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, handler);
  },

  // Theme
  getSystemTheme: (): Promise<'light' | 'dark'> => ipcRenderer.invoke(IPC_CHANNELS.THEME_GET_SYSTEM),

  // Storage
  store: {
    get: <T>(key: string): Promise<T | null> => ipcRenderer.invoke(IPC_CHANNELS.STORE_GET, { key }),
    set: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.STORE_SET, { key, value }),
    delete: (key: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.STORE_DELETE, { key }),
  },

  // External links
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, { url }),

  // Notifications
  showNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_SHOW, { title, body }),

  // Auth
  auth: {
    openTwitchLogin: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_OPEN_TWITCH),
    openKickLogin: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_OPEN_KICK),
    getTokens: (platform: 'twitch' | 'kick'): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_TOKENS, { platform }),
    clearTokens: (platform: 'twitch' | 'kick'): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_CLEAR_TOKENS, { platform }),
    onCallback: (callback: (platform: string, code: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, platform: string, code: string) =>
        callback(platform, code);
      ipcRenderer.on(IPC_CHANNELS.AUTH_ON_CALLBACK, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTH_ON_CALLBACK, handler);
    },
  },
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the exposed API
export type ElectronAPI = typeof electronAPI;
