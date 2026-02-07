/**
 * Window Manager
 *
 * Manages the main window.
 * Handles window state persistence, bounds, and lifecycle.
 */

import path from "node:path";

import { BrowserWindow, globalShortcut, screen } from "electron";

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
  private isDev = process.env.NODE_ENV !== "production";

  /**
   * Register DevTools keyboard shortcuts (development only)
   */
  private registerDevToolsShortcuts(): void {
    if (!this.isDev || !this.mainWindow) return;

    // Register F12 to toggle DevTools
    globalShortcut.register("F12", () => {
      if (this.mainWindow?.webContents) {
        this.mainWindow.webContents.toggleDevTools();
      }
    });

    // Register Ctrl+Shift+I (Windows/Linux) / Cmd+Shift+I (macOS)
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      if (this.mainWindow?.webContents) {
        this.mainWindow.webContents.toggleDevTools();
      }
    });

    console.debug("🔧 DevTools shortcuts registered (F12, Ctrl+Shift+I)");
  }

  /**
   * Unregister DevTools keyboard shortcuts
   */
  private unregisterDevToolsShortcuts(): void {
    if (!this.isDev) return;
    globalShortcut.unregister("F12");
    globalShortcut.unregister("CommandOrControl+Shift+I");
  }

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
      backgroundColor: "#0f0f0f",
      show: false,
      frame: false, // Custom title bar
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 12, y: 12 }, // macOS traffic lights position
      webPreferences: {
        // Preload script is compiled to index.js in the same directory as main.js
        preload: path.join(__dirname, "index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Disabled to allow preload IPC
        webSecurity: false, // Allow CORS for video streams
      },
    });

    // Restore maximized state
    if (savedWindowState?.isMaximized) {
      this.mainWindow.maximize();
    }

    // Show when ready
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();
    });

    // Save window state on close
    this.mainWindow.on("close", () => {
      if (this.mainWindow) {
        savedWindowState = {
          bounds: this.mainWindow.getBounds(),
          isMaximized: this.mainWindow.isMaximized(),
        };
      }
    });

    // Handle window closed
    this.mainWindow.on("closed", () => {
      this.unregisterDevToolsShortcuts();
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

    // Development only: Open DevTools and register shortcuts
    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
      this.registerDevToolsShortcuts();
    }

    return this.mainWindow;
  }

  /**
   * Get the main window instance
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

// Singleton instance
export const windowManager = new WindowManager();
