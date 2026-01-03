import { app, ipcMain, shell, Notification, BrowserWindow, nativeTheme } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

export function registerSystemHandlers(mainWindow: BrowserWindow): void {
    /**
     * Helper to safely send IPC messages to the renderer.
     * Prevents "Render frame was disposed" errors when the window is closing.
     */
    function safeSend(channel: string, ...args: unknown[]): void {
        try {
            if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                mainWindow.webContents.send(channel, ...args);
            }
        } catch {
            console.warn(`⚠️ Could not send to ${channel}: Window disposed`);
        }
    }

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
        safeSend(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, true);
    });

    mainWindow?.on('unmaximize', () => {
        safeSend(IPC_CHANNELS.WINDOW_ON_MAXIMIZE_CHANGE, false);
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

    // ========== Image Proxy (CORS/Hotlinking Bypass) ==========
    /**
     * IMAGE PROXY HANDLER
     * 
     * Fetches images that may be blocked due to CORS or hotlinking restrictions
     * and returns them as base64 data URLs.
     * 
     * CURRENT STATUS:
     * - Kick CDN (files.kick.com, images.kick.com): Uses Electron's net.request with
     *   proper Referer headers to bypass hotlinking protection.
     * - Twitch CDN (jtvnw.net, twitch.tv): Proxied with appropriate Referer/Origin headers.
     * - Other domains: Proxied with generic headers.
     * 
     * WHY NET.REQUEST FOR KICK CDN:
     * - Electron's onBeforeSendHeaders doesn't reliably set Referer for image requests
     *   (known Electron bug: https://github.com/electron/electron/issues/33092)
     * - net.request runs in the main process and can set arbitrary headers
     * - This bypasses Kick's strict hotlinking protection
     * 
     * @see https://docs.kick.com - Kick's official API documentation
     */
    ipcMain.handle(IPC_CHANNELS.IMAGE_PROXY, async (_event, { url }: { url: string }): Promise<string | null> => {
        try {
            // Validate URL
            const parsedUrl = new URL(url);
            if (!parsedUrl.protocol.startsWith('http')) {
                console.warn('⚠️ Image proxy: Invalid protocol:', parsedUrl.protocol);
                return null;
            }

            // Determine CDN type for appropriate headers
            // SECURITY: Use strict hostname matching to prevent subdomain spoofing
            const isKickCDN =
                parsedUrl.hostname === 'files.kick.com' ||
                parsedUrl.hostname.endsWith('.files.kick.com') ||
                parsedUrl.hostname === 'images.kick.com' ||
                parsedUrl.hostname.endsWith('.images.kick.com');

            const isTwitchCDN =
                parsedUrl.hostname === 'jtvnw.net' ||
                parsedUrl.hostname.endsWith('.jtvnw.net') ||
                parsedUrl.hostname === 'twitch.tv' ||
                parsedUrl.hostname.endsWith('.twitch.tv');

            // For Kick CDN, use Electron's net.request (most reliable for setting Referer)
            if (isKickCDN) {
                const { net } = require('electron');

                return new Promise<string | null>((resolve) => {
                    const request = net.request({
                        method: 'GET',
                        url: url,
                    });

                    // Set headers that bypass Kick's hotlinking protection
                    request.setHeader('Accept', 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8');
                    request.setHeader('Accept-Language', 'en-US,en;q=0.9');
                    request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
                    request.setHeader('Referer', 'https://kick.com/');
                    request.setHeader('Origin', 'https://kick.com');

                    let resolved = false;
                    const resolveOnce = (value: string | null) => {
                        if (!resolved) {
                            resolved = true;
                            resolve(value);
                        }
                    };

                    // 10 second timeout
                    const timeout = setTimeout(() => {
                        request.abort();
                        console.warn(`⚠️ Image proxy: Timeout for ${url.substring(0, 60)}...`);
                        resolveOnce(null);
                    }, 10000);

                    request.on('response', (response: any) => {
                        if (response.statusCode !== 200) {
                            clearTimeout(timeout);
                            console.warn(`⚠️ Image proxy: Failed to fetch Kick CDN image: ${response.statusCode}`);
                            resolveOnce(null);
                            return;
                        }

                        const chunks: Buffer[] = [];
                        const contentType = response.headers['content-type'] || 'image/webp';

                        response.on('data', (chunk: Buffer) => {
                            chunks.push(chunk);
                        });

                        response.on('end', () => {
                            clearTimeout(timeout);
                            const buffer = Buffer.concat(chunks);
                            const base64 = buffer.toString('base64');
                            resolveOnce(`data:${contentType};base64,${base64}`);
                        });

                        response.on('error', (error: Error) => {
                            clearTimeout(timeout);
                            console.error('❌ Image proxy response error:', error.message);
                            resolveOnce(null);
                        });
                    });

                    request.on('error', (error: Error) => {
                        clearTimeout(timeout);
                        console.error('❌ Image proxy request error:', error.message);
                        resolveOnce(null);
                    });

                    request.end();
                });
            }

            // For other CDNs (Twitch, etc), use standard fetch
            const headers: Record<string, string> = {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            };

            if (isTwitchCDN) {
                headers['Referer'] = 'https://www.twitch.tv/';
                headers['Origin'] = 'https://www.twitch.tv';
            }

            const response = await fetch(url, {
                headers,
                redirect: 'follow',
            });

            if (!response.ok) {
                console.warn(`⚠️ Image proxy: Failed to fetch ${url}: ${response.status}`);
                return null;
            }

            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');

            return `data:${contentType};base64,${base64}`;
        } catch (error) {
            console.error('❌ Image proxy error:', error);
            return null;
        }
    });
}

