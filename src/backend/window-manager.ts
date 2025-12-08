/**
 * Window Manager
 * 
 * Manages the main window and pop-out windows for multi-stream viewing.
 * Handles window state persistence, bounds, and lifecycle.
 */

import path from 'node:path';

import { app, BrowserWindow, screen } from 'electron';

// Vite globals (provided by Electron Forge's Vite plugin)
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowState {
  bounds: WindowBounds;
  isMaximized: boolean;
}

// In-memory storage for window state (will be replaced with electron-store in Phase 1)
let savedWindowState: WindowState | null = null;

function getDefaultBounds(): WindowBounds {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.floor((width - 1400) / 2),
    y: Math.floor((height - 900) / 2),
    width: 1400,
    height: 900,
  };
}

function ensureWindowIsVisible(bounds: WindowBounds): WindowBounds {
  const displays = screen.getAllDisplays();

  // Check if any part of the window is visible on any display
  const isVisible = displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return (
      bounds.x < x + width &&
      bounds.x + bounds.width > x &&
      bounds.y < y + height &&
      bounds.y + bounds.height > y
    );
  });

  if (!isVisible) {
    return getDefaultBounds();
  }

  return bounds;
}

class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private popoutWindows: Map<string, BrowserWindow> = new Map();

  /**
   * Create the main application window
   */
  createMainWindow(): BrowserWindow {
    const defaultBounds = getDefaultBounds();
    const bounds = savedWindowState?.bounds
      ? ensureWindowIsVisible(savedWindowState.bounds)
      : defaultBounds;

    this.mainWindow = new BrowserWindow({
      ...bounds,
      minWidth: 1024,
      minHeight: 768,
      backgroundColor: '#0f0f0f',
      show: false,
      frame: false, // Custom title bar
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 12 }, // macOS traffic lights position
      webPreferences: {
        // Preload script is compiled to index.js in the same directory as main.js
        preload: path.join(__dirname, 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Disabled to allow preload IPC
      },
    });

    // Restore maximized state
    if (savedWindowState?.isMaximized) {
      this.mainWindow.maximize();
    }

    // Show when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Save window state on close
    this.mainWindow.on('close', () => {
      if (this.mainWindow) {
        savedWindowState = {
          bounds: this.mainWindow.getBounds(),
          isMaximized: this.mainWindow.isMaximized(),
        };
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Load the app
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      this.mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    // Open DevTools in development
    if (process.env.NODE_ENV !== 'production') {
      this.mainWindow.webContents.openDevTools();
    }

    return this.mainWindow;
  }

  /**
   * Get the main window instance
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Create a popout window for stream viewing
   */
  createPopoutWindow(streamId: string): BrowserWindow {
    const popout = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      backgroundColor: '#0f0f0f',
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    // Load with stream URL parameter
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      popout.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/popout/${streamId}`);
    } else {
      popout.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: `/popout/${streamId}` }
      );
    }

    // Track the popout window
    this.popoutWindows.set(streamId, popout);

    popout.on('closed', () => {
      this.popoutWindows.delete(streamId);
    });

    return popout;
  }

  /**
   * Get a popout window by stream ID
   */
  getPopoutWindow(streamId: string): BrowserWindow | undefined {
    return this.popoutWindows.get(streamId);
  }

  /**
   * Close all popout windows
   */
  closeAllPopouts(): void {
    this.popoutWindows.forEach((window) => {
      window.close();
    });
    this.popoutWindows.clear();
  }
}

// Singleton instance
export const windowManager = new WindowManager();
