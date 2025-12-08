/**
 * IPC Handlers for Main Process
 *
 * Handles all IPC messages from the renderer process.
 * This file aggregates handlers from the ipc/handlers directory.
 */

import { BrowserWindow } from 'electron';

import { registerSystemHandlers } from './ipc/handlers/system-handlers';
import { registerStorageHandlers } from './ipc/handlers/storage-handlers';
import { registerAuthHandlers } from './ipc/handlers/auth-handlers';
import { registerStreamHandlers } from './ipc/handlers/stream-handlers';
import { registerCategoryHandlers } from './ipc/handlers/category-handlers';
import { registerSearchHandlers } from './ipc/handlers/search-handlers';
import { registerChannelHandlers } from './ipc/handlers/channel-handlers';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Register all handlers
  registerSystemHandlers(mainWindow);
  registerStorageHandlers();
  registerAuthHandlers(mainWindow);
  registerStreamHandlers();
  registerCategoryHandlers();
  registerSearchHandlers();
  registerChannelHandlers();

  console.log('✅ All IPC handlers registered successfully');
}
