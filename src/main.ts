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

import { registerIpcHandlers } from './backend/ipc-handlers';
import { windowManager } from './backend/window-manager';
import { protocolHandler } from './backend/auth';


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
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
app.on('ready', () => {
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

// Security: Prevent new window creation from renderer
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

