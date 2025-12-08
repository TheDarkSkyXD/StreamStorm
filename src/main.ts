/**
 * StreamStorm - Main Process Entry Point
 * 
 * This is the Electron main process that handles window creation,
 * system integration, and IPC communication with the renderer.
 */

/// <reference path="../forge.env.d.ts" />

import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { windowManager } from './backend/window-manager';
import { registerIpcHandlers } from './backend/ipc-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// App lifecycle events
app.on('ready', () => {
  const mainWindow = windowManager.createMainWindow();
  registerIpcHandlers(mainWindow);
  console.log('🌩️ StreamStorm main process started');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const mainWindow = windowManager.createMainWindow();
    registerIpcHandlers(mainWindow);
  }
});

// Security: Prevent new window creation from renderer
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
