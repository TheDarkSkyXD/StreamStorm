/**
 * StreamStorm - Main Process Entry Point
 * 
 * This is the Electron main process that handles window creation,
 * system integration, and IPC communication with the renderer.
 */

// Load environment variables from .env file FIRST (before other imports)
import 'dotenv/config';

import { app, BrowserWindow, session } from 'electron';
import started from 'electron-squirrel-startup';
import * as fs from 'fs';
import * as path from 'path';

import { registerIpcHandlers } from './backend/ipc-handlers';
import { windowManager } from './backend/window-manager';
import { protocolHandler } from './backend/auth';

// Sentinel file to track clean shutdown
const CLEAN_SHUTDOWN_FILE = path.join(app.getPath('userData'), '.clean-shutdown');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

/**
 * Check if the last shutdown was clean (sentinel file exists)
 * If not, the app likely crashed and cache may be corrupted
 */
function wasCleanShutdown(): boolean {
  try {
    return fs.existsSync(CLEAN_SHUTDOWN_FILE);
  } catch {
    return false;
  }
}

/**
 * Mark the current session as running (remove sentinel)
 * Sentinel will be written back on clean shutdown
 */
function markSessionStarted(): void {
  try {
    if (fs.existsSync(CLEAN_SHUTDOWN_FILE)) {
      fs.unlinkSync(CLEAN_SHUTDOWN_FILE);
    }
  } catch (e) {
    console.warn('⚠️ Failed to remove clean shutdown marker:', e);
  }
}

/**
 * Mark the session as cleanly shutdown (write sentinel)
 */
function markCleanShutdown(): void {
  try {
    fs.writeFileSync(CLEAN_SHUTDOWN_FILE, new Date().toISOString());
  } catch (e) {
    console.warn('⚠️ Failed to write clean shutdown marker:', e);
  }
}

/**
 * Setup request interceptors for CDN domains that require special headers
 * This modifies outgoing requests at the Chromium level before they're sent
 */
function setupRequestInterceptors(): void {
  // Intercept requests to Kick CDN and add proper headers
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        'https://files.kick.com/*',
        'https://images.kick.com/*',
      ]
    },
    (details, callback) => {
      // Add headers that make the request appear to come from kick.com
      const modifiedHeaders = {
        ...details.requestHeaders,
        'Referer': 'https://kick.com/',
        'Origin': 'https://kick.com',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-site',
      };

      callback({ requestHeaders: modifiedHeaders });
    }
  );
}

// App lifecycle events
app.on('ready', async () => {
  // Check if last shutdown was clean - if not, clear cache to fix potential corruption
  // "Invalid cache (current) size" errors happen when cache metadata is inconsistent
  const cleanShutdown = wasCleanShutdown();

  if (!cleanShutdown) {
    console.log('🔍 Detected unclean shutdown, clearing cache to prevent corruption...');
    try {
      await session.defaultSession.clearCache();
      console.log('🧹 Cleared disk cache');
    } catch (e) {
      console.warn('⚠️ Failed to clear cache:', e);
    }
  } else {
    console.log('✅ Clean shutdown detected, preserving cache');
  }

  // Mark session as started (remove sentinel until clean shutdown)
  markSessionStarted();

  // Register custom protocol handler for OAuth callbacks (streamstorm://)
  protocolHandler.registerProtocol();

  // Setup request interceptors for CDN domains
  setupRequestInterceptors();

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

// Mark clean shutdown before quitting
app.on('before-quit', () => {
  markCleanShutdown();
});

// Security: Prevent new window creation from renderer
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
