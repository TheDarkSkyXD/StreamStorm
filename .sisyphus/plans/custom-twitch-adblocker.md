# Custom Twitch Ad Blocker Implementation Plan (ENHANCED)

**Goal**: Build a comprehensive ad blocker for StreamStorm using Ghostery's techniques - network blocking, CSS injection, scriptlet injection, and DOM observation - without external dependencies.

---

## CRITICAL ISSUE DISCOVERED

The explore agent found WHY the current `AdBlockFallbackOverlay` doesn't work:

```
The overlay ONLY appears when ALL backup types fail completely (network failure).
When ads are present but being "stripped", isUsingFallbackMode = FALSE, so:
- Overlay is HIDDEN (user sees black/purple screen)
- Audio is NOT muted
- Purple "Commercial Break" screen passes through as "live" segments
```

**This means we need BOTH:**
1. Fix the existing HLS-level fallback logic
2. Add Ghostery-style DOM features as additional defense

---

## Ghostery's Three-Layer Approach

From analyzing Ghostery's source code (`packages/adblocker-electron/src/index.ts`):

```typescript
// LAYER 1: Network Blocking
session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, this.onBeforeRequest);

// LAYER 2: CSP Header Modification  
session.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, this.onHeadersReceived);

// LAYER 3: DOM Manipulation (via IPC from preload)
ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', this.onInjectCosmeticFilters);

// In onInjectCosmeticFilters:
if (styles.length > 0) {
  event.sender.insertCSS(styles, { cssOrigin: 'user' });
}
for (const script of scripts) {
  event.sender.executeJavaScript(script, true);
}
```

---

## Implementation Architecture (THREE LAYERS)

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: NETWORK BLOCKING                    │
│  session.webRequest.onBeforeRequest                             │
│  - Block ad servers (edge.ads.twitch.tv)                        │
│  - Block telemetry (spade, countess, science)                   │
│  - Block third-party ad SDKs (IMA, DoubleClick)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: HLS MANIPULATION                    │
│  twitch-adblock-service.ts + twitch-adblock-loader.ts           │
│  - Detect 'stitched' ad signifier in m3u8                       │
│  - Swap to backup streams with alternate playerType             │
│  - Strip ad segments, replace with blank video                  │
│  - **FIX: Show overlay when stripping, not just on failure**    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               LAYER 3: DOM MANIPULATION (NEW)                   │
│  CSS Injection + Scriptlets + MutationObserver                  │
│  - Hide any purple overlay that slips through                   │
│  - Inject scriptlets to neutralize ad scripts                   │
│  - MutationObserver to catch dynamically added elements         │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: Fix Existing HLS Fallback Logic

### Task 0A: Fix isUsingFallbackMode Logic
**File**: `src/components/player/twitch/twitch-adblock-service.ts`
**Priority**: CRITICAL
**Parallelizable**: NO (must be done first)

**Problem**: `isUsingFallbackMode` is only `true` when ALL backup types fail completely. It should be `true` whenever we're stripping ads (no clean stream found).

**Current Logic (line ~292-300)**:
```typescript
if (backupResult) {
  text = backupResult;
  streamInfo.isUsingFallbackMode = false;  // ← WRONG: Should be true if backup has ads
} else {
  // All backup types failed - enter fallback mode
  streamInfo.isUsingFallbackMode = true;  // ← Only triggers on total failure
}
```

**Fixed Logic**:
```typescript
if (backupResult) {
  text = backupResult;
  // Check if backup STILL has ads (needs stripping)
  const backupHasAds = backupResult.includes(config.adSignifier);
  streamInfo.isUsingFallbackMode = backupHasAds;  // TRUE if we're stripping
  if (!backupHasAds) {
    console.debug(`[AdBlock] Using clean backup stream (${streamInfo.activeBackupPlayerType})`);
  } else {
    console.debug(`[AdBlock] Backup has ads, entering stripping/fallback mode`);
  }
} else {
  // All backup types failed - enter fallback mode
  streamInfo.isUsingFallbackMode = true;
}
```

---

### Task 0B: Fix Muting Logic
**File**: `src/components/player/twitch/twitch-live-player.tsx`
**Priority**: CRITICAL
**Parallelizable**: YES (with Task 0A)

**Problem**: Muting only happens when `isUsingFallbackMode && isShowingAd`. But if we're stripping, we want muting too.

**Current Logic (line ~98-112)**:
```typescript
if (adBlockStatus?.isUsingFallbackMode && adBlockStatus?.isShowingAd) {
  // Mute
}
```

**Fixed Logic**: Mute whenever `isShowingAd` and we don't have a clean stream:
```typescript
// Mute during ANY ad situation (fallback mode OR stripping mode)
if (adBlockStatus?.isShowingAd && (adBlockStatus?.isUsingFallbackMode || adBlockStatus?.isStrippingSegments)) {
  // Save mute state and mute
  preFallbackMuteRef.current = video.muted;
  video.muted = true;
}
```

---

## PHASE 2: Network-Level Blocking

### Task 1: Create Network Ad Blocker Service
**File**: `src/backend/services/network-adblock-service.ts` (NEW)
**Parallelizable**: NO (foundation)

```typescript
import { session } from 'electron';

interface BlockStats {
  totalBlocked: number;
  byCategory: Record<string, number>;
  recentBlocked: string[];
}

interface BlockRule {
  pattern: RegExp;
  category: string;
  description: string;
}

class NetworkAdBlockService {
  private isEnabled = true;
  private stats: BlockStats = { totalBlocked: 0, byCategory: {}, recentBlocked: [] };
  
  // Twitch-specific blocking rules
  private readonly rules: BlockRule[] = [
    // Critical: Ad servers
    { pattern: /^https?:\/\/edge\.ads\.twitch\.tv/i, category: 'ads', description: 'Twitch ad server' },
    
    // High: Telemetry/Analytics
    { pattern: /^https?:\/\/spade\.twitch\.tv/i, category: 'telemetry', description: 'Twitch analytics' },
    { pattern: /^https?:\/\/countess\.twitch\.tv/i, category: 'telemetry', description: 'Twitch analytics' },
    { pattern: /^https?:\/\/science\.twitch\.tv/i, category: 'telemetry', description: 'Twitch telemetry' },
    
    // High: Third-party ad SDKs
    { pattern: /^https?:\/\/imasdk\.googleapis\.com/i, category: 'ads', description: 'Google IMA SDK' },
    { pattern: /^https?:\/\/pubads\.g\.doubleclick\.net/i, category: 'ads', description: 'DoubleClick' },
    { pattern: /^https?:\/\/pagead2\.googlesyndication\.com/i, category: 'ads', description: 'Google Ads' },
    { pattern: /^https?:\/\/.*\.amazon-adsystem\.com/i, category: 'ads', description: 'Amazon Ads' },
    
    // Medium: Event tracking
    { pattern: /^https?:\/\/client-event-reporter\.twitch\.tv/i, category: 'tracking', description: 'Event reporter' },
    { pattern: /^https?:\/\/trowel\.twitch\.tv/i, category: 'tracking', description: 'Trowel tracking' },
  ];

  shouldBlock(url: string): { blocked: boolean; rule?: BlockRule } {
    if (!this.isEnabled) return { blocked: false };
    const matchedRule = this.rules.find(rule => rule.pattern.test(url));
    if (matchedRule) {
      this.recordBlock(url, matchedRule);
      return { blocked: true, rule: matchedRule };
    }
    return { blocked: false };
  }

  private recordBlock(url: string, rule: BlockRule): void {
    this.stats.totalBlocked++;
    this.stats.byCategory[rule.category] = (this.stats.byCategory[rule.category] || 0) + 1;
    this.stats.recentBlocked.unshift(url);
    if (this.stats.recentBlocked.length > 50) {
      this.stats.recentBlocked.pop();
    }
    console.debug(`[NetworkAdBlock] Blocked: ${rule.description}`);
  }

  enable(): void { this.isEnabled = true; }
  disable(): void { this.isEnabled = false; }
  toggle(): boolean { this.isEnabled = !this.isEnabled; return this.isEnabled; }
  getStats(): BlockStats { return { ...this.stats }; }
  isActive(): boolean { return this.isEnabled; }
}

export const networkAdBlockService = new NetworkAdBlockService();
```

---

### Task 2: Integrate in Main Process
**File**: `src/main.ts`
**Parallelizable**: NO (depends on Task 1)

Modify `setupRequestInterceptors()`:

```typescript
import { networkAdBlockService } from './backend/services/network-adblock-service';

function setupRequestInterceptors(): void {
  // Network-level ad blocking (onBeforeRequest)
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['<all_urls>'] },
    (details, callback) => {
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
```

---

## PHASE 3: DOM Manipulation (Ghostery-Inspired)

### Task 3: Create Cosmetic Injection Service
**File**: `src/backend/services/cosmetic-injection-service.ts` (NEW)
**Parallelizable**: YES (with Task 1)

This service handles CSS injection and scriptlet execution via the main process.

```typescript
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
```

---

### Task 4: Create MutationObserver Hook (Renderer-Side)
**File**: `src/hooks/use-ad-element-observer.ts` (NEW)
**Parallelizable**: YES (with Task 3)

This runs in the renderer and watches for dynamically-added ad elements.

```typescript
import { useEffect, useRef } from 'react';

/**
 * Selectors for Twitch ad elements to hide
 * These are the DOM elements that show "Commercial Break in Progress"
 */
const AD_SELECTORS = [
  '[data-test-selector="ad-banner-default-text"]',
  '[data-test-selector="sad-overlay"]',
  '.player-ad-overlay',
  '.stream-display-ad',
];

/**
 * Hook that observes the DOM for ad elements and hides them
 * Inspired by Ghostery's MutationObserver pattern
 */
export function useAdElementObserver(enabled: boolean = true) {
  const observerRef = useRef<MutationObserver | null>(null);
  const hiddenCount = useRef(0);

  useEffect(() => {
    if (!enabled) {
      observerRef.current?.disconnect();
      return;
    }

    const hideElement = (element: Element) => {
      if (element instanceof HTMLElement) {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        hiddenCount.current++;
        console.debug('[AdElementObserver] Hidden element:', element.className || element.tagName);
      }
    };

    const checkAndHide = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as Element;
      
      // Check if this element matches any ad selector
      for (const selector of AD_SELECTORS) {
        if (element.matches(selector)) {
          hideElement(element);
          return;
        }
        // Also check descendants
        element.querySelectorAll(selector).forEach(hideElement);
      }
    };

    // Hide any existing ad elements
    AD_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(hideElement);
    });

    // Watch for new elements
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          checkAndHide(node);
        }
      }
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.debug('[AdElementObserver] Started watching for ad elements');

    return () => {
      observerRef.current?.disconnect();
      console.debug(`[AdElementObserver] Stopped. Hidden ${hiddenCount.current} elements.`);
    };
  }, [enabled]);

  return { hiddenCount: hiddenCount.current };
}
```

---

### Task 5: Integrate Observer in Player
**File**: `src/components/player/twitch/twitch-live-player.tsx`
**Parallelizable**: NO (depends on Task 4)

Add the hook to the Twitch player:

```typescript
import { useAdElementObserver } from '@/hooks/use-ad-element-observer';

export function TwitchLivePlayer(props: TwitchLivePlayerProps) {
  // ... existing code ...
  
  // Watch for and hide any ad elements that slip through
  useAdElementObserver(effectiveEnableAdBlock);
  
  // ... rest of component ...
}
```

---

## PHASE 4: IPC & UI Integration

### Task 6: Add IPC Channels
**File**: `src/shared/ipc-channels.ts`
**Parallelizable**: YES (with Task 1)

```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...
  
  // Network Ad Blocking
  ADBLOCK_GET_STATUS: 'adblock:get-status',
  ADBLOCK_TOGGLE: 'adblock:toggle',
  ADBLOCK_GET_STATS: 'adblock:get-stats',
  
  // Cosmetic Injection
  ADBLOCK_INJECT_COSMETICS: 'adblock:inject-cosmetics',
} as const;
```

---

### Task 7: Create IPC Handlers
**File**: `src/backend/ipc/handlers/adblock-handlers.ts` (NEW)
**Parallelizable**: YES (with Task 1, 3, 6)

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc-channels';
import { networkAdBlockService } from '../../services/network-adblock-service';
import { cosmeticInjectionService } from '../../services/cosmetic-injection-service';

export function registerAdBlockHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.ADBLOCK_GET_STATUS, async () => {
    return {
      networkBlockingEnabled: networkAdBlockService.isActive(),
      cosmeticFilteringEnabled: cosmeticInjectionService.isActive(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.ADBLOCK_TOGGLE, async (_event, { network, cosmetic }: { network?: boolean; cosmetic?: boolean }) => {
    if (typeof network === 'boolean') {
      network ? networkAdBlockService.enable() : networkAdBlockService.disable();
    }
    if (typeof cosmetic === 'boolean') {
      cosmetic ? cosmeticInjectionService.enable() : cosmeticInjectionService.disable();
    }
    return {
      networkBlockingEnabled: networkAdBlockService.isActive(),
      cosmeticFilteringEnabled: cosmeticInjectionService.isActive(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.ADBLOCK_GET_STATS, async () => {
    return networkAdBlockService.getStats();
  });
}
```

---

### Task 8: Register Handlers
**File**: `src/backend/ipc-handlers.ts`
**Parallelizable**: NO (depends on Task 7)

```typescript
import { registerAdBlockHandlers } from './ipc/handlers/adblock-handlers';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ... existing handlers ...
  registerAdBlockHandlers(mainWindow);
}
```

---

### Task 9: Initialize Services in Main
**File**: `src/main.ts`
**Parallelizable**: NO (depends on Task 2, 3)

```typescript
import { cosmeticInjectionService } from './backend/services/cosmetic-injection-service';

app.on('ready', async () => {
  // ... existing code ...
  
  // Initialize ad blocking services
  cosmeticInjectionService.initialize();
  
  // Setup request interceptors (includes network blocking)
  setupRequestInterceptors();
  
  const mainWindow = windowManager.createMainWindow();
  
  // Inject cosmetics into main window
  cosmeticInjectionService.injectIntoWindow(mainWindow);
  
  // ... rest of existing code ...
});
```

---

### Task 10: Expose in Preload
**File**: `src/preload/index.ts`
**Parallelizable**: YES (with Task 6, 7)

```typescript
// Add to electronAPI object:
adblock: {
  getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.ADBLOCK_GET_STATUS),
  toggle: (options: { network?: boolean; cosmetic?: boolean }) => 
    ipcRenderer.invoke(IPC_CHANNELS.ADBLOCK_TOGGLE, options),
  getStats: () => ipcRenderer.invoke(IPC_CHANNELS.ADBLOCK_GET_STATS),
  injectCosmetics: () => ipcRenderer.invoke(IPC_CHANNELS.ADBLOCK_INJECT_COSMETICS),
},
```

---

### Task 11: Create React Hook
**File**: `src/hooks/use-adblock.ts` (NEW)
**Parallelizable**: YES (after Task 10)

```typescript
import { useState, useEffect, useCallback } from 'react';

interface AdBlockState {
  networkBlockingEnabled: boolean;
  cosmeticFilteringEnabled: boolean;
  stats: {
    totalBlocked: number;
    byCategory: Record<string, number>;
  } | null;
  isLoading: boolean;
}

export function useAdBlock() {
  const [state, setState] = useState<AdBlockState>({
    networkBlockingEnabled: true,
    cosmeticFilteringEnabled: true,
    stats: null,
    isLoading: true,
  });

  const refresh = useCallback(async () => {
    const [status, stats] = await Promise.all([
      window.electronAPI.adblock.getStatus(),
      window.electronAPI.adblock.getStats(),
    ]);
    setState({
      networkBlockingEnabled: status.networkBlockingEnabled,
      cosmeticFilteringEnabled: status.cosmeticFilteringEnabled,
      stats,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(async (options: { network?: boolean; cosmetic?: boolean }) => {
    const result = await window.electronAPI.adblock.toggle(options);
    setState(prev => ({
      ...prev,
      networkBlockingEnabled: result.networkBlockingEnabled,
      cosmeticFilteringEnabled: result.cosmeticFilteringEnabled,
    }));
    return result;
  }, []);

  return { ...state, toggle, refresh };
}
```

---

### Task 12: Add Settings UI
**File**: Settings page
**Parallelizable**: NO (depends on Task 11)

Add toggle switches for:
- Network-level ad blocking (blocks requests)
- Cosmetic filtering (hides elements)
- Show blocked stats

---

### Task 13: Testing & Verification
**Parallelizable**: NO (final step)

1. Run `npm run typecheck` - must pass
2. Run `npm run lint` - must pass  
3. Test Twitch stream playback:
   - Stream loads successfully
   - No purple "Commercial Break" screen
   - Audio muted during ads
   - Fallback overlay appears when stripping
4. Verify in DevTools:
   - `spade.twitch.tv` requests blocked
   - CSS injected (check Elements panel)
5. Test toggle functionality

---

## Parallelization Map

```
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 0: Fix Existing Logic (CRITICAL - DO FIRST)                   │
├──────────────────────────────────────────────────────────────────────┤
│  Task 0A (fix isUsingFallbackMode) ───┬─── Task 0B (fix muting)      │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 1-3: Network + Cosmetic (PARALLEL)                             │
├──────────────────────────────────────────────────────────────────────┤
│  Task 1 (network-service) ──┬──── Task 3 (cosmetic-service)          │
│            │                │                │                       │
│            ▼                ▼                ▼                       │
│      Task 2 (main.ts)   Task 6 (channels)  Task 4 (observer hook)   │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 4: IPC & UI Integration                                        │
├──────────────────────────────────────────────────────────────────────┤
│  Task 7 (handlers) ── Task 8 (register) ── Task 9 (init main)       │
│            │                                                         │
│            ▼                                                         │
│      Task 10 (preload) ── Task 11 (hook) ── Task 5 (integrate)      │
│                                    │                                 │
│                                    ▼                                 │
│                            Task 12 (UI) ── Task 13 (test)           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/player/twitch/twitch-adblock-service.ts` | MODIFY | Fix isUsingFallbackMode logic |
| `src/components/player/twitch/twitch-live-player.tsx` | MODIFY | Fix muting logic, add observer |
| `src/backend/services/network-adblock-service.ts` | CREATE | Network request blocking |
| `src/backend/services/cosmetic-injection-service.ts` | CREATE | CSS/JS injection |
| `src/hooks/use-ad-element-observer.ts` | CREATE | MutationObserver for ad elements |
| `src/hooks/use-adblock.ts` | CREATE | React hook for adblock state |
| `src/main.ts` | MODIFY | Initialize services |
| `src/shared/ipc-channels.ts` | MODIFY | Add adblock channels |
| `src/backend/ipc/handlers/adblock-handlers.ts` | CREATE | IPC handlers |
| `src/backend/ipc-handlers.ts` | MODIFY | Register handlers |
| `src/preload/index.ts` | MODIFY | Expose adblock API |
| Settings page | MODIFY | Add toggle UI |

---

## Ghostery Features Covered

| Feature | Ghostery | Our Implementation |
|---------|----------|-------------------|
| `onBeforeRequest` | ✅ Block network requests | ✅ Task 1-2 |
| `onHeadersReceived` | ✅ CSP modification | ❌ Not needed for StreamStorm |
| `insertCSS` | ✅ Cosmetic filtering | ✅ Task 3 |
| `executeJavaScript` | ✅ Scriptlet injection | ✅ Task 3 |
| `MutationObserver` | ✅ Dynamic element hiding | ✅ Task 4 |
| Preload script | ✅ IPC bridge | ✅ Task 10 |
| Filter list parsing | ✅ Complex engine | ❌ Hardcoded Twitch rules |

---

## Success Criteria

1. **No purple screen**: User never sees "Commercial Break in Progress"
2. **Audio muted**: No ad audio during ad breaks
3. **Overlay shown**: User sees "Blocking ads" overlay during stripping
4. **Requests blocked**: spade.twitch.tv, edge.ads.twitch.tv blocked
5. **Elements hidden**: Any ad DOM elements hidden immediately
6. **Toggleable**: User can enable/disable each layer
