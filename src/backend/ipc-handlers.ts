/**
 * IPC Handlers for Main Process
 * 
 * Handles all IPC messages from the renderer process.
 */

import { app, ipcMain, shell, Notification, BrowserWindow, nativeTheme } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ========== App Info ==========
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_NAME, () => {
    return app.getName();
  });

  // ========== Window Management ==========
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Send maximize change events to renderer
  mainWindow?.on('maximize', () => {
    mainWindow.webContents.send(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, true);
  });

  mainWindow?.on('unmaximize', () => {
    mainWindow.webContents.send(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, false);
  });

  // ========== Theme ==========
  ipcMain.handle(IPC_CHANNELS.THEME_GET_SYSTEM, () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  // ========== Storage ==========
  // Note: For production, use electron-store for persistence
  const memoryStore = new Map<string, unknown>();

  ipcMain.handle(IPC_CHANNELS.STORE_GET, (_event, { key }: { key: string }) => {
    return memoryStore.get(key) ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.STORE_SET, (_event, { key, value }: { key: string; value: unknown }) => {
    memoryStore.set(key, value);
  });

  ipcMain.handle(IPC_CHANNELS.STORE_DELETE, (_event, { key }: { key: string }) => {
    memoryStore.delete(key);
  });

  // ========== External Links ==========
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_event, { url }: { url: string }) => {
    // Validate URL before opening
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        await shell.openExternal(url);
      }
    } catch {
      console.error('Invalid URL:', url);
    }
  });

  // ========== Notifications ==========
  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SHOW, (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: undefined, // TODO: Add app icon
      });
      notification.show();
    }
  });

  // ========== Auth ==========
  // Placeholder handlers - will be implemented in Phase 1
  ipcMain.handle(IPC_CHANNELS.AUTH_OPEN_TWITCH, () => {
    console.log('Opening Twitch login...');
    // TODO: Implement OAuth flow
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_OPEN_KICK, () => {
    console.log('Opening Kick login...');
    // TODO: Implement OAuth flow
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_TOKENS, (_event, { platform }: { platform: string }) => {
    console.log('Getting tokens for:', platform);
    // TODO: Get from secure storage
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CLEAR_TOKENS, (_event, { platform }: { platform: string }) => {
    console.log('Clearing tokens for:', platform);
    // TODO: Clear from secure storage
  });

  console.log('IPC handlers registered');
}
