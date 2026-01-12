/**
 * StreamStorm - Main Process Entry Point
 * 
 * This is the Electron main process that handles window creation,
 * system integration, and IPC communication with the renderer.
 */

// Load environment variables from .env file FIRST (before other imports)
import 'dotenv/config';

import { app, BrowserWindow, session, Menu } from 'electron';
import started from 'electron-squirrel-startup';
import * as fs from 'fs';
import * as path from 'path';

import { registerIpcHandlers } from './backend/ipc-handlers';
import { windowManager } from './backend/window-manager';
import { protocolHandler } from './backend/auth';
import { networkAdBlockService } from './backend/services/network-adblock-service';
import { cosmeticInjectionService } from './backend/services/cosmetic-injection-service';
import { twitchManifestProxy } from './backend/services/twitch-manifest-proxy';

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
 * Setup request interceptors for Kick CDN domains that require special headers
 * and network-level ad blocking for Twitch.
 * 
 * NOTE: This is a SECONDARY fallback mechanism. The primary approach is the IPC proxy
 * in system-handlers.ts which uses Electron's net.request (more reliable).
 * 
 * This interceptor catches any direct image loads that bypass the ProxiedImage component.
 */
function setupRequestInterceptors(): void {
  // Twitch manifest proxy (handles m3u8 interception for ad removal)
  // MUST be registered before the general onBeforeRequest handler
  twitchManifestProxy.registerInterceptor();

  // Network-level ad blocking (onBeforeRequest)
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['<all_urls>'] },
    (details, callback) => {
      // Skip manifest URLs - handled by twitchManifestProxy
      if (details.url.includes('ttvnw.net') && details.url.includes('.m3u8')) {
        callback({});
        return;
      }

      const result = networkAdBlockService.shouldBlock(details.url);
      if (result.blocked) {
        callback({ cancel: true });
        return;
      }
      callback({});
    }
  );

  // Header modification for Kick CDN (onBeforeSendHeaders)
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        'https://files.kick.com/*',
        'https://*.files.kick.com/*',
        'https://images.kick.com/*',
        'https://*.images.kick.com/*',
      ]
    },
    (details, callback) => {
      const modifiedHeaders = { ...details.requestHeaders };
      modifiedHeaders['Referer'] = 'https://kick.com/';
      callback({ requestHeaders: modifiedHeaders });
    }
  );
}

// App lifecycle events
app.on('ready', async () => {
  // Disable the default application menu since we use a custom frameless window
  // This saves memory and avoids unnecessary menu resource allocation
  Menu.setApplicationMenu(null);

  // Check if last shutdown was clean - if not, clear cache to fix potential corruption
  // "Invalid cache (current) size" errors happen when cache metadata is inconsistent
  const cleanShutdown = wasCleanShutdown();

  if (!cleanShutdown) {
    console.debug('🔍 Detected unclean shutdown, clearing cache to prevent corruption...');
    try {
      await session.defaultSession.clearCache();
      console.debug('🧹 Cleared disk cache');
    } catch (e) {
      console.warn('⚠️ Failed to clear cache:', e);
    }
  } else {
    console.debug('✅ Clean shutdown detected, preserving cache');
  }

  // Mark session as started (remove sentinel until clean shutdown)
  markSessionStarted();

  // Register custom protocol handler for OAuth callbacks (streamstorm://)
  protocolHandler.registerProtocol();

  // Initialize ad blocking services
  cosmeticInjectionService.initialize();

  // Setup request interceptors for CDN domains and ad blocking
  setupRequestInterceptors();

  const mainWindow = windowManager.createMainWindow();
  
  // Inject cosmetics into main window
  cosmeticInjectionService.injectIntoWindow(mainWindow);
  
  registerIpcHandlers(mainWindow);
  console.debug('🌩️ StreamStorm main process started');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const mainWindow = windowManager.createMainWindow();
    cosmeticInjectionService.injectIntoWindow(mainWindow);
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
