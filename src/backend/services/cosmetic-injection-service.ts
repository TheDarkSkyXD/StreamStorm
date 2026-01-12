/**
 * Cosmetic Injection Service
 * 
 * Handles CSS injection and scriptlet execution for ad element hiding.
 * Inspired by Ghostery's insertCSS and executeJavaScript patterns.
 */

import { ipcMain, BrowserWindow } from 'electron';

// CSS rules to hide Twitch ad elements (if they ever appear in our context)
const TWITCH_COSMETIC_CSS = `
/* Hide any ad-related overlays that might slip through */
[data-test-selector="ad-banner-default-text"],
[data-test-selector="sad-overlay"],
.video-player__overlay[data-a-target="player-overlay-click-handler"]:has(.stream-display-ad),
.player-ad-overlay,
.player-streamlink-ad,
.video-player__default-player > .tw-absolute:has(img[alt*="ad"]),
.video-player__container .tw-absolute.tw-c-background-overlay {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* Ensure video is always visible */
video {
  visibility: visible !important;
  opacity: 1 !important;
}
`;

// Scriptlet to intercept ad-related function calls (Ghostery pattern)
const TWITCH_SCRIPTLETS = `
(function() {
  'use strict';
  
  // Abort on property read - if code tries to read ad-related properties
  const abortOnPropertyRead = (obj, prop) => {
    Object.defineProperty(obj, prop, {
      get: function() {
        throw new ReferenceError('Blocked by StreamStorm AdBlock');
      },
      set: function() {}
    });
  };
  
  // Try to neutralize common ad-related globals (safe to fail)
  try {
    if (typeof window.twitchAdConfig !== 'undefined') {
      abortOnPropertyRead(window, 'twitchAdConfig');
    }
  } catch(e) {}
})();
`;

class CosmeticInjectionService {
  private isEnabled = true;
  private injectedWindows = new WeakSet<Electron.WebContents>();

  initialize(): void {
    // Handle IPC requests from renderer to inject cosmetics
    ipcMain.handle('adblock:inject-cosmetics', async (event) => {
      if (!this.isEnabled) return { injected: false };
      
      try {
        await event.sender.insertCSS(TWITCH_COSMETIC_CSS, { cssOrigin: 'user' });
        await event.sender.executeJavaScript(TWITCH_SCRIPTLETS, true);
        return { injected: true };
      } catch (e) {
        console.error('[CosmeticInjection] Failed:', e);
        return { injected: false, error: String(e) };
      }
    });
    
    console.debug('[CosmeticInjection] Service initialized');
  }

  // Inject into a specific window (called on window creation)
  async injectIntoWindow(window: BrowserWindow): Promise<void> {
    if (!this.isEnabled) return;
    if (this.injectedWindows.has(window.webContents)) return;
    
    try {
      await window.webContents.insertCSS(TWITCH_COSMETIC_CSS, { cssOrigin: 'user' });
      await window.webContents.executeJavaScript(TWITCH_SCRIPTLETS, true);
      this.injectedWindows.add(window.webContents);
      console.debug('[CosmeticInjection] Injected into window');
    } catch (e) {
      console.error('[CosmeticInjection] Failed to inject into window:', e);
    }
  }

  enable(): void { this.isEnabled = true; }
  disable(): void { this.isEnabled = false; }
  isActive(): boolean { return this.isEnabled; }
}

export const cosmeticInjectionService = new CosmeticInjectionService();
