import { app, ipcMain, shell, Notification, BrowserWindow, nativeTheme, net } from 'electron';
import * as https from 'https';
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
     * This handler fetches images that are blocked due to CORS or hotlinking restrictions
     * (e.g., Kick CDN's files.kick.com) and returns them as base64 data URLs.
     * 
     * WHY THIS IS NECESSARY:
     * - Kick CDN (files.kick.com) returns 403 Forbidden for requests without a valid Referer header
     * - Browser/Electron renderer processes cannot set Referer headers for cross-origin requests
     * - Desktop apps need to display user profile images, offline banners, etc.
     * 
     * APPROACH:
     * - Uses Electron's main process `net.request` which can set arbitrary headers
     * - Spoofs Referer header to appear as a request from kick.com
     * - Converts response to base64 data URL for use in renderer
     * 
     * ⚠️ SECURITY & COMPLIANCE CONSIDERATIONS:
     * 
     * 1. HEADER SPOOFING:
     *    - Modifies User-Agent and Referer headers to bypass origin checks
     *    - This circumvents the Fetch Metadata Request Headers security mechanism
     * 
     * 2. TERMS OF SERVICE:
     *    - This approach may violate Kick's Terms of Service
     *    - Kick has an official API (https://docs.kick.com) but as of Dec 2025,
     *      it does not provide a documented method for unauthenticated CDN access
     *    - Consider checking https://developers.kick.com for future API updates
     * 
     * 3. ALTERNATIVES CONSIDERED:
     *    - Official Kick API: Does not currently support CDN image access
     *    - CORS proxy server: Would require hosting infrastructure
     *    - Disable images: Poor UX for a streaming application
     * 
     * 4. MITIGATION:
     *    - This feature is opt-in via preferences.advanced.enableImageProxy
     *    - Users can disable it if they have compliance concerns
     *    - The feature gracefully degrades (shows placeholder) if disabled
     * 
     * @see https://docs.kick.com - Kick's official API documentation
     * @see https://developers.kick.com - Kick developer registration
     */
    ipcMain.handle(IPC_CHANNELS.IMAGE_PROXY, async (_event, { url }: { url: string }): Promise<string | null> => {
        try {
            // Validate URL
            const parsedUrl = new URL(url);
            if (!parsedUrl.protocol.startsWith('http')) {
                console.warn('⚠️ Image proxy: Invalid protocol:', parsedUrl.protocol);
                return null;
            }

            // Determine the appropriate headers based on the domain
            const isKickCDN = parsedUrl.hostname.includes('kick.com') ||
                parsedUrl.hostname.includes('images.kick.com') ||
                parsedUrl.hostname.includes('files.kick.com');

            // For Kick CDN, use Node.js https module (more reliable than Electron's net for this)
            if (isKickCDN) {
                return new Promise<string | null>((resolve) => {
                    let resolved = false;

                    const resolveOnce = (value: string | null) => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeoutId);
                            resolve(value);
                        }
                    };

                    let currentReq: any = null;

                    // 10 second timeout to prevent hanging indefinitely
                    const timeoutId = setTimeout(() => {
                        if (currentReq) {
                            currentReq.destroy();
                        }
                        console.warn('⚠️ Image proxy (https): Request timed out for', url.substring(0, 60));
                        resolveOnce(null);
                    }, 10000);

                    const options = {
                        headers: {
                            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                            'Referer': 'https://kick.com/',
                        }
                    };

                    currentReq = https.get(url, options, (response) => {
                        // Handle redirects
                        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                            const redirectUrl = response.headers.location;
                            if (redirectUrl) {
                                response.destroy(); // Clean up original response
                                // Follow redirect with same options
                                currentReq = https.get(redirectUrl, options, (redirectResponse) => {
                                    handleResponse(redirectResponse);
                                }).on('error', (error) => {
                                    console.error('❌ Image proxy redirect error:', error.message);
                                    resolveOnce(null);
                                });
                                return;
                            }
                        }

                        handleResponse(response);
                    });

                    function handleResponse(response: any) {
                        if (response.statusCode !== 200) {
                            console.warn(`⚠️ Image proxy: Failed to fetch ${url.substring(0, 80)}... Status: ${response.statusCode}`);
                            resolveOnce(null);
                            return;
                        }

                        const chunks: Buffer[] = [];
                        const contentType = response.headers['content-type'] || 'image/jpeg';

                        response.on('data', (chunk: Buffer) => {
                            chunks.push(chunk);
                        });

                        response.on('end', () => {
                            const buffer = Buffer.concat(chunks);
                            const base64 = buffer.toString('base64');
                            resolveOnce(`data:${contentType};base64,${base64}`);
                        });

                        response.on('error', (error: Error) => {
                            console.error('❌ Image proxy response error:', error.message);
                            resolveOnce(null);
                        });
                    }

                    currentReq.on('error', (error: Error) => {
                        console.error('❌ Image proxy request error:', error.message);
                        resolveOnce(null);
                    });
                });
            }

            // For other CDNs (Twitch, etc), use regular fetch
            const isTwitchCDN = parsedUrl.hostname.includes('jtvnw.net') ||
                parsedUrl.hostname.includes('twitch.tv');

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
