/**
 * IPC Handlers for Main Process
 *
 * Handles all IPC messages from the renderer process.
 */

import { app, ipcMain, shell, Notification, BrowserWindow, nativeTheme } from 'electron';

import { Platform, AuthToken, LocalFollow, UserPreferences, TwitchUser, KickUser } from '../shared/auth-types';
import { IPC_CHANNELS, AuthStatus } from '../shared/ipc-channels';

import { storageService } from './services/storage-service';
import {
  authWindowManager,
  oauthCallbackServer,
  tokenExchangeService,
  twitchAuthService,
  kickAuthService,
  validateOAuthConfig,
  deviceCodeFlowService,
  getOAuthConfig,
} from './auth';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
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

  // ========== Generic Storage (backward compatibility) ==========
  ipcMain.handle(IPC_CHANNELS.STORE_GET, (_event, { key }: { key: string }) => {
    return storageService.get(key as keyof typeof storageService.get);
  });

  ipcMain.handle(IPC_CHANNELS.STORE_SET, (_event, { key, value }: { key: string; value: unknown }) => {
    storageService.set(key as any, value as any);
  });

  ipcMain.handle(IPC_CHANNELS.STORE_DELETE, (_event, { key }: { key: string }) => {
    storageService.delete(key as any);
  });

  // ========== Auth - Token Management ==========
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_TOKEN, (_event, { platform }: { platform: Platform }) => {
    return storageService.getToken(platform);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SAVE_TOKEN, (_event, { platform, token }: { platform: Platform; token: AuthToken }) => {
    storageService.saveToken(platform, token);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CLEAR_TOKEN, (_event, { platform }: { platform: Platform }) => {
    storageService.clearToken(platform);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_HAS_TOKEN, (_event, { platform }: { platform: Platform }) => {
    return storageService.hasToken(platform);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_IS_TOKEN_EXPIRED, (_event, { platform }: { platform: Platform }) => {
    return storageService.isTokenExpired(platform);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CLEAR_ALL_TOKENS, () => {
    storageService.clearAllTokens();
  });

  // ========== Auth - User Data ==========
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_TWITCH_USER, () => {
    return storageService.getTwitchUser();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SAVE_TWITCH_USER, (_event, { user }: { user: TwitchUser }) => {
    storageService.saveTwitchUser(user);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CLEAR_TWITCH_USER, () => {
    storageService.clearTwitchUser();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_KICK_USER, () => {
    return storageService.getKickUser();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SAVE_KICK_USER, (_event, { user }: { user: KickUser }) => {
    storageService.saveKickUser(user);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CLEAR_KICK_USER, () => {
    storageService.clearKickUser();
  });

  // ========== Auth - Status ==========
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_STATUS, (): AuthStatus => {
    const twitchUser = storageService.getTwitchUser();
    const kickUser = storageService.getKickUser();
    const twitchHasToken = storageService.hasToken('twitch');
    const kickHasToken = storageService.hasToken('kick');
    const twitchExpired = storageService.isTokenExpired('twitch');
    const kickExpired = storageService.isTokenExpired('kick');

    return {
      twitch: {
        connected: !!twitchUser && twitchHasToken && !twitchExpired,
        user: twitchUser,
        hasToken: twitchHasToken,
        isExpired: twitchExpired,
      },
      kick: {
        connected: !!kickUser && kickHasToken && !kickExpired,
        user: kickUser,
        hasToken: kickHasToken,
        isExpired: kickExpired,
      },
      isGuest: !twitchUser && !kickUser,
    };
  });

  // ========== Local Follows ==========
  ipcMain.handle(IPC_CHANNELS.FOLLOWS_GET_ALL, () => {
    return storageService.getLocalFollows();
  });

  ipcMain.handle(IPC_CHANNELS.FOLLOWS_GET_BY_PLATFORM, (_event, { platform }: { platform: Platform }) => {
    return storageService.getLocalFollowsByPlatform(platform);
  });

  ipcMain.handle(IPC_CHANNELS.FOLLOWS_ADD, (_event, { follow }: { follow: Omit<LocalFollow, 'id' | 'followedAt'> }) => {
    return storageService.addLocalFollow(follow);
  });

  ipcMain.handle(IPC_CHANNELS.FOLLOWS_REMOVE, (_event, { id }: { id: string }) => {
    return storageService.removeLocalFollow(id);
  });

  ipcMain.handle(IPC_CHANNELS.FOLLOWS_UPDATE, (_event, { id, updates }: { id: string; updates: Partial<LocalFollow> }) => {
    return storageService.updateLocalFollow(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS.FOLLOWS_IS_FOLLOWING, (_event, { platform, channelId }: { platform: Platform; channelId: string }) => {
    return storageService.isFollowing(platform, channelId);
  });

  ipcMain.handle(IPC_CHANNELS.FOLLOWS_IMPORT, (_event, { follows }: { follows: LocalFollow[] }) => {
    return storageService.importLocalFollows(follows);
  });

  ipcMain.handle(IPC_CHANNELS.FOLLOWS_CLEAR, () => {
    storageService.clearLocalFollows();
  });

  // ========== User Preferences ==========
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, () => {
    return storageService.getPreferences();
  });

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_UPDATE, (_event, { updates }: { updates: Partial<UserPreferences> }) => {
    return storageService.updatePreferences(updates);
  });

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_RESET, () => {
    storageService.resetPreferences();
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

  // ========== Auth - OAuth Flow using Localhost Callback Server ==========

  // Track in-progress OAuth flows to prevent state mismatch from multiple clicks
  const pendingOAuthFlows: Map<Platform, { cancel: () => void }> = new Map();

  /**
   * Handle OAuth flow for a platform using localhost callback server
   */
  async function handleOAuthFlow(platform: Platform): Promise<void> {
    // Validate OAuth config first
    const configErrors = validateOAuthConfig(platform);
    if (configErrors.length > 0) {
      throw new Error(`OAuth not configured: ${configErrors.join(', ')}`);
    }

    // Cancel any existing OAuth flow for this platform to prevent state mismatch
    const existingFlow = pendingOAuthFlows.get(platform);
    if (existingFlow) {
      console.log(`⚠️ Cancelling previous OAuth flow for ${platform}`);
      existingFlow.cancel();
      pendingOAuthFlows.delete(platform);
    }

    // Stop any existing callback server before starting a new one
    oauthCallbackServer.stop();

    // Open auth window and get session info
    const { pkce, state, redirectUri, port } = authWindowManager.openAuthWindow(platform);

    // Create a cancellation mechanism for this flow
    let isCancelled = false;
    const flowControl = {
      cancel: () => {
        isCancelled = true;
        oauthCallbackServer.stop();
        authWindowManager.closeAuthWindow(platform);
      }
    };
    pendingOAuthFlows.set(platform, flowControl);

    try {
      // Start the localhost callback server and wait for the callback
      const callbackResult = await oauthCallbackServer.waitForCallback(platform, state, { port });

      // Check if this flow was cancelled (a newer flow started)
      if (isCancelled) {
        console.log(`🛑 OAuth flow for ${platform} was cancelled`);
        return;
      }

      console.log(`📥 Received OAuth callback for ${platform}`);

      // Exchange the code for a token
      const token = await tokenExchangeService.exchangeCodeForToken({
        platform,
        code: callbackResult.code,
        redirectUri,
        pkce,
      });

      // Save the token
      storageService.saveToken(platform, token);

      console.log(`✅ Successfully authenticated with ${platform}`);

      // Fetch user info after token is saved
      if (platform === 'twitch') {
        try {
          const user = await twitchAuthService.fetchCurrentUser();
          if (user) {
            storageService.saveTwitchUser(user);
          }
        } catch (userError) {
          console.error('Failed to fetch Twitch user info:', userError);
        }
      } else if (platform === 'kick') {
        try {
          const user = await kickAuthService.fetchCurrentUser();
          if (user) {
            storageService.saveKickUser(user);
          }
        } catch (userError) {
          console.error('Failed to fetch Kick user info:', userError);
        }
      }

      // Notify renderer of successful auth
      mainWindow.webContents.send(IPC_CHANNELS.AUTH_ON_CALLBACK, {
        platform,
        success: true,
      });
    } catch (error) {
      // Don't report errors for cancelled flows
      if (isCancelled) {
        console.log(`🛑 Ignoring error from cancelled OAuth flow for ${platform}`);
        return;
      }

      console.error(`❌ OAuth failed for ${platform}:`, error);

      // Notify renderer of failed auth
      mainWindow.webContents.send(IPC_CHANNELS.AUTH_ON_CALLBACK, {
        platform,
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      });

      throw error;
    } finally {
      // Clean up: remove from pending flows
      pendingOAuthFlows.delete(platform);
      // Always close the auth window
      authWindowManager.closeAuthWindow(platform);
      // Stop the callback server
      oauthCallbackServer.stop();
    }
  }

  // Handle opening Twitch OAuth
  ipcMain.handle(IPC_CHANNELS.AUTH_OPEN_TWITCH, async () => {
    console.log('🔐 Opening Twitch login...');
    try {
      await handleOAuthFlow('twitch');
      return { success: true };
    } catch (error) {
      console.error('Twitch OAuth error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  });

  // Handle opening Kick OAuth
  ipcMain.handle(IPC_CHANNELS.AUTH_OPEN_KICK, async () => {
    console.log('🔐 Opening Kick login...');
    try {
      await handleOAuthFlow('kick');
      return { success: true };
    } catch (error) {
      console.error('Kick OAuth error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  });

  // ========== Twitch Auth Operations ==========

  // Handle Twitch logout
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT_TWITCH, async () => {
    console.log('🚪 Logging out from Twitch...');
    try {
      await twitchAuthService.logout();
      mainWindow.webContents.send(IPC_CHANNELS.AUTH_ON_CALLBACK, {
        platform: 'twitch',
        success: true,
        loggedOut: true,
      });
      return { success: true };
    } catch (error) {
      console.error('❌ Twitch logout failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Logout failed' };
    }
  });

  // Handle Twitch token refresh
  ipcMain.handle(IPC_CHANNELS.AUTH_REFRESH_TWITCH, async () => {
    console.log('🔄 Refreshing Twitch token...');
    try {
      const token = await twitchAuthService.refreshToken();
      if (token) {
        return { success: true, token };
      }
      return { success: false, error: 'Token refresh failed' };
    } catch (error) {
      console.error('❌ Twitch token refresh failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' };
    }
  });

  // Handle fetching Twitch user info
  ipcMain.handle(IPC_CHANNELS.AUTH_FETCH_TWITCH_USER, async () => {
    console.log('👤 Fetching Twitch user info...');
    try {
      const user = await twitchAuthService.fetchCurrentUser();
      if (user) {
        return { success: true, user };
      }
      return { success: false, error: 'Failed to fetch user info' };
    } catch (error) {
      console.error('❌ Failed to fetch Twitch user:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch user info' };
    }
  });

  // ========== Kick Auth Operations ==========

  // Handle Kick logout
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async (_event, { platform }: { platform: Platform }) => {
    if (platform === 'twitch') {
      // Forward to existing handler or reuse logic
      await twitchAuthService.logout();
    } else if (platform === 'kick') {
      await kickAuthService.logout();
    }

    mainWindow.webContents.send(IPC_CHANNELS.AUTH_ON_CALLBACK, {
      platform,
      success: true,
      loggedOut: true,
    });
    return { success: true };
  });

  // Handle Kick logout (specific channel)
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT_KICK, async () => {
    console.log('🚪 Logging out from Kick...');
    try {
      await kickAuthService.logout();
      mainWindow.webContents.send(IPC_CHANNELS.AUTH_ON_CALLBACK, {
        platform: 'kick',
        success: true,
        loggedOut: true,
      });
      return { success: true };
    } catch (error) {
      console.error('❌ Kick logout failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Logout failed' };
    }
  });

  // Handle Kick user fetch
  ipcMain.handle(IPC_CHANNELS.AUTH_FETCH_KICK_USER, async () => {
    console.log('👤 Fetching Kick user info...');
    try {
      const user = await kickAuthService.fetchCurrentUser();
      if (user) {
        return { success: true, user };
      }
      return { success: false, error: 'Failed to fetch user info' };
    } catch (error) {
      console.error('❌ Failed to fetch Kick user:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch user info' };
    }
  });

  // ========== Device Code Flow (Twitch) ==========

  // Start device code flow - returns codes for user to enter
  ipcMain.handle(IPC_CHANNELS.AUTH_DCF_START, async () => {
    console.log('🔐 Starting Device Code Flow for Twitch...');
    try {
      const config = getOAuthConfig('twitch');

      if (!config.clientId) {
        throw new Error('TWITCH_CLIENT_ID is not set. Please add it to your .env file.');
      }

      const result = await deviceCodeFlowService.requestDeviceCode(config.scopes);

      // Open the verification URL in the default browser
      shell.openExternal(result.verificationUri);

      return {
        success: true,
        userCode: result.userCode,
        verificationUri: result.verificationUri,
        deviceCode: result.deviceCode,
        expiresIn: result.expiresIn,
        interval: result.interval,
      };
    } catch (error) {
      console.error('❌ Failed to start device code flow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start device code flow',
      };
    }
  });

  // Poll for token after user authorizes
  ipcMain.handle(IPC_CHANNELS.AUTH_DCF_POLL, async (_event, { deviceCode, interval, expiresIn }: {
    deviceCode: string;
    interval: number;
    expiresIn: number;
  }) => {
    console.log('🔄 Polling for Twitch authorization...');
    try {
      const token = await deviceCodeFlowService.pollForToken(
        deviceCode,
        interval,
        expiresIn,
        (status, message) => {
          // Send status updates to renderer
          mainWindow.webContents.send(IPC_CHANNELS.AUTH_DCF_STATUS, { status, message });
        }
      );

      // Save the token
      storageService.saveToken('twitch', token);

      // Fetch user info
      const user = await twitchAuthService.fetchCurrentUser();
      if (user) {
        storageService.saveTwitchUser(user);
      }

      // Notify renderer
      mainWindow.webContents.send(IPC_CHANNELS.AUTH_ON_CALLBACK, {
        platform: 'twitch',
        success: true,
      });

      return { success: true, user };
    } catch (error) {
      console.error('❌ Device code flow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authorization failed',
      };
    }
  });

  // Cancel device code flow
  ipcMain.handle(IPC_CHANNELS.AUTH_DCF_CANCEL, () => {
    console.log('🛑 Cancelling device code flow...');
    deviceCodeFlowService.stopPolling();
    return { success: true };
  });

  console.log('✅ IPC handlers registered with storage service and OAuth handlers');
}
