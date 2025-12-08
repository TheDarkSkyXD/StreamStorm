import { app, ipcMain, shell, Notification, BrowserWindow, nativeTheme } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

export function registerSystemHandlers(mainWindow: BrowserWindow): void {
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

    // ========== Image Proxy (CORS bypass) ==========
    ipcMain.handle(IPC_CHANNELS.IMAGE_PROXY, async (_event, { url }: { url: string }): Promise<string | null> => {
        try {
            // Validate URL
            const parsedUrl = new URL(url);
            if (!parsedUrl.protocol.startsWith('http')) {
                console.warn('⚠️ Image proxy: Invalid protocol:', parsedUrl.protocol);
                return null;
            }

            // Fetch image from main process (no CORS restrictions)
            const response = await fetch(url, {
                headers: {
                    'Accept': 'image/*',
                    'User-Agent': 'StreamStorm/1.0',
                },
            });

            if (!response.ok) {
                console.warn(`⚠️ Image proxy: Failed to fetch ${url}: ${response.status}`);
                return null;
            }

            // Get content type
            const contentType = response.headers.get('content-type') || 'image/jpeg';

            // Convert to base64
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');

            // Return as data URL
            return `data:${contentType};base64,${base64}`;
        } catch (error) {
            console.error('❌ Image proxy error:', error);
            return null;
        }
    });
}
