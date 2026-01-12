# Ghostery Adblocker Integration Plan

**Goal**: Enhance Twitch ad-blocking by adding network-level request blocking via `@ghostery/adblocker-electron` to complement the existing HLS-level ad stripping.

## Current State Analysis

### What We Have (Working)
1. **HLS-Level Ad Blocking** (`twitch-adblock-service.ts`):
   - Detects ads via 'stitched' signifier in m3u8 playlists
   - Fetches backup streams with alternate playerType values
   - Strips ad segments from playlist
   - Replaces ad segment URLs with blank video data URL
   - Strips parent_domains/referrer from access tokens

2. **Custom HLS.js Loaders** (`twitch-adblock-loader.ts`):
   - pLoader: Intercepts playlist requests, processes m3u8
   - fLoader: Intercepts fragment requests, replaces ad segments

3. **Integration** (`twitch-hls-player.tsx`):
   - Configures HLS.js with custom loaders
   - Handles player reload/pause-resume signals from ad-block service

### The Problem: "Commercial Break in Progress"
When all backup player types fail:
1. User sees purple "Commercial Break in Progress" screen
2. This is a **client-side overlay** Twitch renders when it detects ad-blocking OR has no ads to serve
3. Current system enters "fallback mode" but can't remove the overlay

### Root Causes
1. **No network-level blocking**: Twitch ad telemetry/tracking requests still get through
2. **No ad request interception**: Ad manifest/segment requests from Twitch ad servers aren't blocked
3. **Missing custom filters**: No Twitch-specific blocking rules at network level

## Solution: Two-Layer Ad Blocking

### Layer 1: Network-Level (Ghostery)
Block requests at Electron session level BEFORE they reach the renderer:
- Twitch ad telemetry endpoints
- Ad tracking/analytics
- SSAI (Server-Side Ad Insertion) signaling

### Layer 2: HLS-Level (Existing)
Continue processing m3u8 playlists to:
- Strip ad segments from manifests
- Swap to backup streams without ads
- Replace ad segment URLs with blank video

## Implementation Tasks

### Task 1: Install Ghostery Adblocker Package
**File**: `package.json`
**Action**: Add `@ghostery/adblocker-electron` dependency

```bash
npm install @ghostery/adblocker-electron
```

**Parallelizable**: YES

---

### Task 2: Create Ghostery Blocker Service
**File**: `src/backend/services/ghostery-blocker-service.ts` (NEW)

Create a service that:
1. Initializes `ElectronBlocker` from prebuilt filters on app ready
2. Enables blocking in the default session
3. Adds custom Twitch-specific filter rules
4. Exposes events for blocked request logging (dev only)
5. Provides enable/disable toggle

**Key Code Pattern**:
```typescript
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { session } from 'electron';

class GhosteryBlockerService {
  private blocker: ElectronBlocker | null = null;
  private isEnabled = true;

  async initialize(): Promise<void> {
    this.blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    
    // Add Twitch-specific custom rules
    // Block ad telemetry, tracking, etc.
    
    if (this.isEnabled) {
      this.blocker.enableBlockingInSession(session.defaultSession);
    }
  }
}
```

**Custom Twitch Filter Rules** (research-based):
```
||imasdk.googleapis.com^ (Google IMA SDK - ad player)
||pubads.g.doubleclick.net^ (DoubleClick ad serving)
||pagead2.googlesyndication.com^ (Google ad syndication)
||amazon-adsystem.com^ (Amazon ads)
||video-weaver.*.hls.ttvnw.net/*.ts$domain=twitch.tv (ad segments)
||usher.ttvnw.net^$removeparam=stitched (strip stitched param)
||gql.twitch.tv^$removeparam=platform,domain=twitch.tv
||spade.twitch.tv^ (Twitch analytics/telemetry)
||countess.twitch.tv^ (Twitch analytics)
||science.twitch.tv^ (Twitch telemetry)
```

**Parallelizable**: NO (depends on Task 1)

---

### Task 3: Integrate Blocker in Main Process
**File**: `src/main.ts`

Modify app ready handler to:
1. Initialize Ghostery blocker before creating window
2. Pass session to blocker for request interception

**Changes**:
```typescript
import { ghosteryBlockerService } from './backend/services/ghostery-blocker-service';

app.on('ready', async () => {
  // ... existing code ...
  
  // Initialize Ghostery adblocker (before window creation)
  await ghosteryBlockerService.initialize();
  
  // ... rest of existing code ...
});
```

**Parallelizable**: NO (depends on Task 2)

---

### Task 4: Add IPC Handlers for Blocker Control
**File**: `src/backend/ipc/handlers/adblock-handlers.ts` (NEW)

Create IPC handlers for:
1. `adblock:get-status` - Get current blocker state
2. `adblock:toggle` - Enable/disable network blocking
3. `adblock:get-stats` - Get blocked request count

**Parallelizable**: YES (with Task 2)

---

### Task 5: Update IPC Channels
**File**: `src/shared/ipc-channels.ts`

Add new channel definitions:
```typescript
export const IpcChannels = {
  // ... existing ...
  ADBLOCK_GET_STATUS: 'adblock:get-status',
  ADBLOCK_TOGGLE: 'adblock:toggle', 
  ADBLOCK_GET_STATS: 'adblock:get-stats',
} as const;
```

**Parallelizable**: YES (with Task 2)

---

### Task 6: Expose in Preload
**File**: `src/preload/index.ts`

Add adblock API to context bridge:
```typescript
adblock: {
  getStatus: () => ipcRenderer.invoke(IpcChannels.ADBLOCK_GET_STATUS),
  toggle: (enabled: boolean) => ipcRenderer.invoke(IpcChannels.ADBLOCK_TOGGLE, enabled),
  getStats: () => ipcRenderer.invoke(IpcChannels.ADBLOCK_GET_STATS),
}
```

**Parallelizable**: YES (with Task 4, 5)

---

### Task 7: Update Preload Types
**File**: `src/preload/types.ts`

Add TypeScript definitions for new adblock API.

**Parallelizable**: YES (with Task 6)

---

### Task 8: Create React Hook for Adblock Status
**File**: `src/hooks/use-adblock.ts` (NEW)

Create hook that:
1. Queries current adblock status
2. Provides toggle function
3. Exposes blocked stats
4. Combines network-level + HLS-level status

**Parallelizable**: YES (with Task 6, 7)

---

### Task 9: Add Adblock Toggle to Settings UI
**File**: `src/pages/settings/SettingsPage.tsx` (or similar)

Add UI toggle for:
- Network-level ad blocking (Ghostery)
- HLS-level ad blocking (existing)
- Show blocked request stats

**Parallelizable**: NO (depends on Task 8)

---

### Task 10: Testing & Verification
1. Verify app starts without errors
2. Verify Ghostery blocker initializes
3. Test Twitch stream playback:
   - Stream loads successfully
   - Ad requests are blocked (check dev tools network tab)
   - No "Commercial Break" purple screen during ads
4. Test toggle functionality
5. Run typecheck and lint

**Parallelizable**: NO (depends on all previous tasks)

## Parallelization Map

```
Task 1 (npm install)
    │
    ▼
Task 2 (ghostery-blocker-service.ts) ─────┬──────────────────────────┐
    │                                      │                          │
    │                                 Task 4 (handlers)          Task 5 (channels)
    │                                      │                          │
    ▼                                      └──────────┬───────────────┘
Task 3 (main.ts integration)                          │
    │                                                 │
    │                                            Task 6 (preload)
    │                                                 │
    │                                            Task 7 (types)
    │                                                 │
    │                                            Task 8 (hook)
    │                                                 │
    └────────────────────────────────────────────────┬┘
                                                     │
                                                Task 9 (UI)
                                                     │
                                                Task 10 (test)
```

**Parallel Groups**:
- Group A: Tasks 4, 5 (can run with Task 2)
- Group B: Tasks 6, 7, 8 (can run after Group A)
- Sequential: Task 1 → 2 → 3, Task 9 → 10

## Success Criteria

1. **Functional**: App starts, streams play, no purple "Commercial Break" screen during ads
2. **Observable**: Console logs blocked requests, stats available in UI
3. **Measurable**: Reduced ad-related network requests visible in dev tools
4. **Toggleable**: User can enable/disable both layers independently

## Technical Notes

### Why Both Layers?
- **Network-level (Ghostery)**: Blocks tracking/telemetry that helps Twitch detect ad-blocking
- **HLS-level (existing)**: Handles SSAI by swapping streams and stripping segments

### Ghostery vs uBlock Origin
Ghostery's `@ghostery/adblocker-electron` is purpose-built for Electron:
- Native session integration
- No browser extension overhead
- Supports custom filter rules
- Active maintenance

### Risk: Breaking Legit Requests
Custom Twitch rules must be carefully crafted to:
- Block ad infrastructure (imasdk, spade, countess)
- NOT block stream content (video-weaver for non-ads)
- NOT block chat, follows, subscriptions

### Fallback Strategy
If Ghostery causes issues:
1. Easy disable via IPC toggle
2. Full disable via config
3. Graceful degradation to HLS-only blocking

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | MODIFY | Add @ghostery/adblocker-electron |
| `src/backend/services/ghostery-blocker-service.ts` | CREATE | Ghostery initialization & control |
| `src/main.ts` | MODIFY | Initialize blocker on app ready |
| `src/backend/ipc/handlers/adblock-handlers.ts` | CREATE | IPC handlers for blocker control |
| `src/shared/ipc-channels.ts` | MODIFY | Add adblock channels |
| `src/preload/index.ts` | MODIFY | Expose adblock API |
| `src/preload/types.ts` | MODIFY | Add adblock types |
| `src/hooks/use-adblock.ts` | CREATE | React hook for adblock status |
| `src/pages/settings/...` | MODIFY | Add adblock toggle UI |
