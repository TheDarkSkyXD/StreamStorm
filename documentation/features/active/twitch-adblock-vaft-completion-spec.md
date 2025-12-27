# Twitch Ad-Block VAFT Completion Specification

## Status
- **Status:** Active
- **Priority:** High
- **Estimated Complexity:** Medium-High
- **Last Updated:** 2025-12-26
- **Reference:** `twitchadblockscript.md` (VAFT v32.0.0)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Status](#current-implementation-status)
3. [Gap Analysis](#gap-analysis)
4. [Features to Implement](#features-to-implement)
5. [Implementation Details](#implementation-details)
6. [Files to Create](#files-to-create)
7. [Files to Modify](#files-to-modify)
8. [Testing Strategy](#testing-strategy)
9. [Phased Implementation Plan](#phased-implementation-plan)

---

## Executive Summary

This specification documents the remaining features from the TwitchAdSolutions VAFT script (v32.0.0) that need to be implemented to achieve full parity with the reference implementation.

**Current Status:** StreamStorm has implemented ~70% of VAFT's core functionality including:
- ✅ Ad detection via `stitched` keyword and EXT-X-DATERANGE
- ✅ Backup player type rotation
- ✅ Random X-Device-Id generation
- ✅ Real-time HLS.js event monitoring
- ✅ Ad overlay UI component

**Remaining Work:** This spec covers the missing 30% focused on:
- 🔧 Resolution-matched backup stream selection
- 🔧 Manifest manipulation (prefetch stripping, segment caching)
- 🔧 Player stability features (buffering recovery, reload optimization)
- 🔧 Visibility state handling for background playback

---

## Current Implementation Status

### ✅ Fully Implemented

| Feature | VAFT Lines | Our Implementation |
|---------|------------|-------------------|
| `VAFT_AD_SIGNIFIER = 'stitched'` | 24 | `adblock-types.ts:23` |
| `TWITCH_CLIENT_ID` | 25 | `adblock-types.ts:29` |
| Backup player types (`embed`, `site`, `autoplay`, `picture-by-picture`) | 26-31 | `adblock-types.ts:41-46` |
| `autoplay` uses `platform: 'android'` | 642 | `adblock-types.ts:44` |
| Random Device ID generation | 654-659 | `adblock-types.ts:204-223` |
| Force `playerType: 'site'` for access token | 33 | `adblock-types.ts:57` |
| EXT-X-DATERANGE ad detection | 189-202 | `twitch-hls-detector.ts:193-197` |
| Segment title detection (`Amazon`, `Adform`, `DCM`) | 79 | `twitch-hls-detector.ts:179` |
| `,live` segment suffix detection | 401 | `adblock-types.ts:151-161` |
| Midroll detection (`"MIDROLL"`) | 473 | `adblock-types.ts:269-275` |
| GQL PlaybackAccessToken query | 633-651 | `twitch-adblock-service.ts:60-82` |
| Ad-end debounce (2 seconds) | N/A | `twitch-hls-detector.ts:69` |
| HLS.js event monitoring | N/A | `twitch-hls-detector.ts:110-111` |
| Ad overlay UI | 757-775 | `AdBlockOverlay.tsx` |

### ⚠️ Partially Implemented

| Feature | VAFT Lines | Status | Gap |
|---------|------------|--------|-----|
| Backup stream M3U8 caching | 528-572 | ⚠️ Partial | Cache exists but not per-playerType |
| Fallback player type (`embed`) | 32 | ⚠️ Defined | Export exists but not used in fallback logic |

### ❌ Not Implemented

| Feature | VAFT Lines | Priority | Complexity |
|---------|------------|----------|------------|
| Resolution-matched backup selection | 431-461 | **High** | Medium |
| Prefetch tag stripping during ads | 414-419 | **High** | Low |
| Per-playerType backup M3U8 caching | 528-544 | **Medium** | Medium |
| Player buffering recovery (pause/play) | 699-756 | **Medium** | Medium |
| Minimal requests after player reload | 516-520 | **Medium** | Low |
| Ad segment stripping from M3U8 | 391-430 | **Low** | High |
| Visibility state spoofing | 971-1027 | **Low** | Medium |
| HEVC codec detection and swapping | 329-355 | **Low** | High |
| Fake ad .ts fetch for tracking | 484-496 | **Low** | Low |

---

## Gap Analysis

### Critical Gaps (Must Fix)

#### 1. Resolution-Matched Backup Selection

**VAFT Implementation (lines 431-461):**
```javascript
function getStreamUrlForResolution(encodingsM3u8, resolutionInfo) {
    const [targetWidth, targetHeight] = resolutionInfo.Resolution.split('x').map(Number);
    // Find matching or closest resolution in backup M3U8
    // Returns the specific variant URL that matches current quality
}
```

**Current Gap:** Our `TwitchBackupStreamService.findAdFreeStream()` returns the master playlist URL without selecting the appropriate quality variant. This means:
- User might get different quality than they selected
- Potential for quality jumps during ad blocking

#### 2. Prefetch Tag Stripping

**VAFT Implementation (lines 414-419):**
```javascript
if (hasStrippedAdSegments) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-TWITCH-PREFETCH:')) {
            lines[i] = '';
        }
    }
}
```

**Current Gap:** HLS.js may prefetch ad segments before we detect them, causing brief ad playback. Stripping prefetch tags prevents this.

### Important Gaps (Should Fix)

#### 3. Per-PlayerType Backup Caching

**VAFT Implementation (lines 528-544):**
```javascript
let encodingsM3u8 = streamInfo.BackupEncodingsM3U8Cache[playerType];
if (!encodingsM3u8) {
    // Fetch and cache
    streamInfo.BackupEncodingsM3U8Cache[playerType] = encodingsM3u8;
}
```

**Current Gap:** Every ad detection causes new token fetch. Caching reduces latency and API load.

#### 4. Player Buffering Recovery

**VAFT Implementation (lines 699-756):**
```javascript
function monitorPlayerBuffering() {
    if (position === lastPosition && bufferDuration < PlayerBufferingDangerZone) {
        numSame++;
        if (numSame >= PlayerBufferingSameStateCount) {
            // Trigger pause/play to unstick player
            player.pause();
            player.play();
        }
    }
}
```

**Current Gap:** Players occasionally get stuck after ad transitions. VAFT monitors and auto-recovers.

#### 5. Minimal Requests After Reload

**VAFT Implementation (lines 516-520):**
```javascript
if (streamInfo.LastPlayerReload > Date.now() - PlayerReloadMinimalRequestsTime) {
    startIndex = PlayerReloadMinimalRequestsPlayerIndex; // Use first backup only
    isDoingMinimalRequests = true;
}
```

**Current Gap:** After player reload, we make full backup rotation causing delays. Should use single backup briefly.

### Nice-to-Have Gaps (Can Defer)

#### 6. Visibility State Spoofing

**VAFT Implementation (lines 971-1027):**
Prevents Twitch from pausing when tab is hidden. Desktop apps benefit from this for PiP and background audio.

#### 7. HEVC Codec Handling

**VAFT Implementation (lines 329-355):**
Swaps HEVC streams to AVC for Chrome compatibility on 2K/4K streams.

#### 8. Ad Segment Stripping

**VAFT Implementation (lines 391-430):**
Strips ad segments entirely from M3U8, replacing with tiny placeholder video.

---

## Features to Implement

### Phase 1: Core Quality & Performance (High Priority)

#### Feature 1.1: Resolution-Matched Backup Selection

**Purpose:** When fetching backup stream, select the variant that matches user's current quality.

**Implementation:**

```typescript
// In twitch-backup-stream-service.ts

interface ResolutionInfo {
    resolution: string;      // e.g., "1920x1080"
    frameRate: number;       // e.g., 60
    codecs?: string;         // e.g., "avc1.4D401F"
    url: string;             // Variant playlist URL
}

/**
 * Parse master playlist and find best matching resolution.
 * Based on VAFT getStreamUrlForResolution (lines 431-461)
 */
function getStreamUrlForResolution(
    masterM3u8: string,
    targetResolution: { width: number; height: number; frameRate?: number }
): string | null {
    const lines = masterM3u8.replace(/\r/g, '').split('\n');
    let matchedUrl: string | null = null;
    let matchedFrameRate = false;
    let closestUrl: string | null = null;
    let closestDiff = Infinity;

    for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF') && lines[i + 1].includes('.m3u8')) {
            const attrs = parseM3U8Attributes(lines[i]);
            const resolution = attrs['RESOLUTION'] as string;
            const frameRate = attrs['FRAME-RATE'] as number;

            if (resolution) {
                const [width, height] = resolution.split('x').map(Number);
                const targetPixels = targetResolution.width * targetResolution.height;
                const candidatePixels = width * height;
                const diff = Math.abs(candidatePixels - targetPixels);

                // Exact or closest match
                if (resolution === `${targetResolution.width}x${targetResolution.height}`) {
                    if (!matchedUrl || (!matchedFrameRate && frameRate === targetResolution.frameRate)) {
                        matchedUrl = lines[i + 1];
                        matchedFrameRate = frameRate === targetResolution.frameRate;
                        if (matchedFrameRate) return matchedUrl;
                    }
                }

                if (diff < closestDiff) {
                    closestUrl = lines[i + 1];
                    closestDiff = diff;
                }
            }
        }
    }

    return matchedUrl || closestUrl;
}
```

#### Feature 1.2: Prefetch Tag Stripping

**Purpose:** Remove `#EXT-X-TWITCH-PREFETCH:` tags during ads to prevent prefetching ad segments.

**Implementation:**

```typescript
// In hls-playlist-parser.ts

/**
 * Strip prefetch tags from M3U8 content when ads are detected.
 * Based on VAFT stripAdSegments (lines 414-419)
 */
export function stripPrefetchTags(m3u8Content: string): string {
    const lines = m3u8Content.replace(/\r/g, '').split('\n');
    return lines
        .filter(line => !line.startsWith('#EXT-X-TWITCH-PREFETCH:'))
        .join('\n');
}

/**
 * Full ad segment processing with prefetch stripping.
 */
export function processM3U8ForAds(
    m3u8Content: string,
    hasAds: boolean
): { content: string; strippedPrefetch: boolean } {
    if (!hasAds) {
        return { content: m3u8Content, strippedPrefetch: false };
    }

    const processed = stripPrefetchTags(m3u8Content);
    return {
        content: processed,
        strippedPrefetch: processed !== m3u8Content
    };
}
```

### Phase 2: Caching & Optimization (Medium Priority)

#### Feature 2.1: Per-PlayerType Backup M3U8 Caching

**Purpose:** Cache backup stream M3U8s per player type to avoid repeated fetches during the same ad break.

**Implementation:**

```typescript
// In twitch-backup-stream-service.ts

interface BackupCacheEntry {
    encodingsM3u8: string;
    tokenValue: string;
    tokenSignature: string;
    fetchedAt: number;
}

export class TwitchBackupStreamService {
    // Cache per channel per playerType
    private backupCache: Map<string, Map<string, BackupCacheEntry>> = new Map();
    private readonly CACHE_TTL_MS = 60000; // 1 minute

    private getCachedBackup(channelLogin: string, playerType: string): BackupCacheEntry | null {
        const channelCache = this.backupCache.get(channelLogin);
        if (!channelCache) return null;

        const entry = channelCache.get(playerType);
        if (!entry) return null;

        // Check if still valid
        if (Date.now() - entry.fetchedAt > this.CACHE_TTL_MS) {
            channelCache.delete(playerType);
            return null;
        }

        return entry;
    }

    private setCachedBackup(
        channelLogin: string,
        playerType: string,
        entry: Omit<BackupCacheEntry, 'fetchedAt'>
    ): void {
        if (!this.backupCache.has(channelLogin)) {
            this.backupCache.set(channelLogin, new Map());
        }
        this.backupCache.get(channelLogin)!.set(playerType, {
            ...entry,
            fetchedAt: Date.now()
        });
    }

    clearCache(channelLogin?: string): void {
        if (channelLogin) {
            this.backupCache.delete(channelLogin);
        } else {
            this.backupCache.clear();
        }
    }
}
```

#### Feature 2.2: Minimal Requests After Reload

**Purpose:** Reduce backup stream requests immediately after player reload to avoid overload.

**Implementation:**

```typescript
// In useAdBlock.ts or twitch-backup-stream-service.ts

interface ReloadTracking {
    lastReloadTime: number;
    minimalRequestsActive: boolean;
}

const MINIMAL_REQUESTS_DURATION_MS = 1500; // 1.5 seconds
const MINIMAL_REQUESTS_PLAYER_INDEX = 0;   // Use 'embed' only

function shouldUseMinimalRequests(lastReloadTime: number): boolean {
    return Date.now() - lastReloadTime < MINIMAL_REQUESTS_DURATION_MS;
}

// In findAdFreeStream:
async findAdFreeStream(options: BackupStreamOptions): Promise<BackupStreamResult | null> {
    const { channelLogin, lastPlayerReload = 0 } = options;

    let strategies = VAFT_BACKUP_PLAYER_TYPES;

    // Use minimal requests mode if just reloaded
    if (shouldUseMinimalRequests(lastPlayerReload)) {
        console.log('[BackupStream] Using minimal requests mode (post-reload)');
        strategies = [VAFT_BACKUP_PLAYER_TYPES[MINIMAL_REQUESTS_PLAYER_INDEX]];
    }

    // ... rest of logic
}
```

### Phase 3: Player Stability (Medium Priority)

#### Feature 3.1: Player Buffering Recovery

**Purpose:** Detect stuck playback and auto-recover by pause/play or player reload.

**Implementation:**

```typescript
// New file: src/hooks/useBufferingRecovery.ts

interface BufferingState {
    position: number;
    bufferedPosition: number;
    bufferDuration: number;
    sameStateCount: number;
    lastFixTime: number;
}

interface UseBufferingRecoveryOptions {
    enabled?: boolean;
    checkIntervalMs?: number;        // Default: 500
    sameStateThreshold?: number;     // Default: 3
    dangerZoneSeconds?: number;      // Default: 1
    minRepeatDelayMs?: number;       // Default: 5000
    usePlayerReload?: boolean;       // Default: false (pause/play)
}

export function useBufferingRecovery(
    videoRef: React.RefObject<HTMLVideoElement>,
    hlsRef: React.RefObject<Hls | null>,
    isAdBlocking: boolean,
    options: UseBufferingRecoveryOptions = {}
) {
    const {
        enabled = true,
        checkIntervalMs = 500,
        sameStateThreshold = 3,
        dangerZoneSeconds = 1,
        minRepeatDelayMs = 5000,
        usePlayerReload = false
    } = options;

    const stateRef = useRef<BufferingState>({
        position: 0,
        bufferedPosition: 0,
        bufferDuration: 0,
        sameStateCount: 0,
        lastFixTime: 0
    });

    useEffect(() => {
        if (!enabled || isAdBlocking) return;

        const checkBuffering = () => {
            const video = videoRef.current;
            if (!video || video.paused || video.ended) return;

            const state = stateRef.current;
            const position = video.currentTime;
            const bufferEnd = video.buffered.length > 0
                ? video.buffered.end(video.buffered.length - 1)
                : 0;
            const bufferDuration = bufferEnd - position;

            // Check if stuck
            const isStuck = (
                position > 0 &&
                (state.position === position || bufferDuration < dangerZoneSeconds) &&
                state.bufferedPosition === bufferEnd &&
                state.bufferDuration >= bufferDuration &&
                Date.now() - state.lastFixTime > minRepeatDelayMs
            );

            if (isStuck) {
                state.sameStateCount++;

                if (state.sameStateCount >= sameStateThreshold) {
                    console.log('[BufferingRecovery] Detected stuck playback, attempting fix');

                    if (usePlayerReload && hlsRef.current) {
                        // Full player reload
                        hlsRef.current.recoverMediaError();
                    } else {
                        // Simple pause/play
                        video.pause();
                        video.play().catch(() => {});
                    }

                    state.lastFixTime = Date.now();
                    state.sameStateCount = 0;
                }
            } else {
                state.sameStateCount = 0;
            }

            // Update state for next check
            state.position = position;
            state.bufferedPosition = bufferEnd;
            state.bufferDuration = bufferDuration;
        };

        const intervalId = setInterval(checkBuffering, checkIntervalMs);
        return () => clearInterval(intervalId);
    }, [enabled, isAdBlocking, checkIntervalMs, sameStateThreshold, dangerZoneSeconds, minRepeatDelayMs, usePlayerReload]);
}
```

### Phase 4: Enhanced Features (Low Priority / Future)

#### Feature 4.1: Visibility State Handling

**Purpose:** Prevent browser from pausing playback when window loses focus.

**Implementation:**

```typescript
// In preload/index.ts or a dedicated visibility-spoof.ts

/**
 * Spoof visibility state to prevent pause on focus loss.
 * Based on VAFT onContentLoaded (lines 971-1027)
 */
export function spoofVisibilityState(): void {
    try {
        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible',
            configurable: true
        });

        Object.defineProperty(document, 'hidden', {
            get: () => false,
            configurable: true
        });

        // Block visibility change events
        const blockEvent = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };

        document.addEventListener('visibilitychange', blockEvent, true);
        document.addEventListener('webkitvisibilitychange', blockEvent, true);

        console.log('[VisibilitySpoof] Enabled');
    } catch (error) {
        console.warn('[VisibilitySpoof] Failed:', error);
    }
}
```

#### Feature 4.2: Ad Segment Stripping (Advanced)

**Purpose:** Replace ad segment URLs with tiny placeholder video.

**Note:** This is complex and may cause playback issues. Consider as future enhancement.

```typescript
// In hls-playlist-parser.ts

// Base64 tiny MP4 placeholder (from VAFT line 246)
const PLACEHOLDER_VIDEO = 'data:video/mp4;base64,AAAAKGZ0eXBtcDQy...';

export function stripAdSegments(
    m3u8Content: string,
    adSegmentCache: Map<string, number>
): { content: string; strippedCount: number } {
    const lines = m3u8Content.replace(/\r/g, '').split('\n');
    let strippedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Identify ad segments (no ',live' suffix)
        if (line.startsWith('#EXTINF') && !line.includes(',live') && i + 1 < lines.length) {
            const segmentUrl = lines[i + 1];
            if (!adSegmentCache.has(segmentUrl)) {
                strippedCount++;
            }
            adSegmentCache.set(segmentUrl, Date.now());
        }
    }

    // Note: Actual replacement with placeholder would be done via custom HLS loader
    return { content: m3u8Content, strippedCount };
}
```

---

## Files to Create

### 1. `src/hooks/useBufferingRecovery.ts`

**Purpose:** Monitor player for stuck buffering and trigger recovery.

**Exports:**
- `useBufferingRecovery(videoRef, hlsRef, isAdBlocking, options)`

### 2. `src/backend/adblock/manifest-processor.ts`

**Purpose:** Process M3U8 manifests to strip prefetch tags and handle resolution matching.

**Exports:**
- `stripPrefetchTags(m3u8Content: string): string`
- `getStreamUrlForResolution(masterM3u8, targetResolution): string | null`
- `processM3U8ForAds(m3u8Content, hasAds): ProcessedM3U8`

---

## Files to Modify

### 1. `src/backend/adblock/twitch-backup-stream-service.ts`

**Changes:**
- Add per-playerType M3U8 caching
- Add resolution matching when selecting backup variant
- Add minimal requests mode after reload
- Add `clearCache()` method

### 2. `src/hooks/useAdBlock.ts`

**Changes:**
- Track `lastPlayerReloadTime` for minimal requests mode
- Pass current resolution to backup stream finder
- Clear backup cache when stream changes

### 3. `src/components/player/hls-player.tsx`

**Changes:**
- Integrate `useBufferingRecovery` hook
- Option to process manifests before HLS.js (future: custom loader)

### 4. `src/backend/adblock/hls-playlist-parser.ts`

**Changes:**
- Add `stripPrefetchTags()` function
- Add `getStreamUrlForResolution()` function

### 5. `src/shared/adblock-types.ts`

**Changes:**
- Add `BackupCacheEntry` interface
- Add `ResolutionInfo` interface
- Add buffer recovery options interface

---

## Testing Strategy

### Test Case 1: Resolution Matching

**Steps:**
1. Start stream at 1080p60
2. Trigger ad (wait for preroll or midroll)
3. Observe backup stream selection

**Expected:**
- Backup stream matches or is closest to 1080p60
- No visible quality jump during ad block

### Test Case 2: Prefetch Prevention

**Steps:**
1. Enable console logging for HLS.js
2. Wait for ad to be detected
3. Check prefetch segment requests

**Expected:**
- No `#EXT-X-TWITCH-PREFETCH:` segments requested during ads
- No brief ad frames visible before blocking kicks in

### Test Case 3: Backup Caching

**Steps:**
1. Trigger first ad break
2. Note time to find backup stream
3. Trigger second ad break within 1 minute

**Expected:**
- Second backup selection is faster (cache hit)
- Console shows "Using cached backup for [playerType]"

### Test Case 4: Buffering Recovery

**Steps:**
1. Artificially degrade network or simulate stuck buffer
2. Wait 1.5 seconds (3 checks at 500ms)

**Expected:**
- "[BufferingRecovery] Detected stuck playback" logged
- Pause/play triggered
- Playback resumes

### Test Case 5: Minimal Requests

**Steps:**
1. Trigger player reload (source switch)
2. Immediately trigger ad detection

**Expected:**
- Only first backup playerType tried for 1.5 seconds
- Console shows "Using minimal requests mode (post-reload)"

---

## Phased Implementation Plan

### Phase 1: Core Quality (Estimated: 4-6 hours)
**Priority: HIGH**

| Task | File | Complexity |
|------|------|------------|
| Implement `getStreamUrlForResolution()` | `hls-playlist-parser.ts` | Medium |
| Integrate resolution matching in backup service | `twitch-backup-stream-service.ts` | Medium |
| Add `stripPrefetchTags()` | `hls-playlist-parser.ts` | Low |
| Unit tests for resolution matching | Test files | Low |

### Phase 2: Caching & Optimization (Estimated: 3-4 hours)
**Priority: MEDIUM**

| Task | File | Complexity |
|------|------|------------|
| Add per-playerType caching | `twitch-backup-stream-service.ts` | Medium |
| Track lastPlayerReloadTime | `useAdBlock.ts` | Low |
| Implement minimal requests mode | `twitch-backup-stream-service.ts` | Low |
| Add cache clear on stream change | `useAdBlock.ts` | Low |

### Phase 3: Player Stability (Estimated: 3-4 hours)
**Priority: MEDIUM**

| Task | File | Complexity |
|------|------|------------|
| Create `useBufferingRecovery` hook | `useBufferingRecovery.ts` | Medium |
| Integrate in HLS player | `hls-player.tsx` | Low |
| Add recovery options to settings | Settings UI | Low |

### Phase 4: Enhanced Features (Estimated: 4-6 hours)
**Priority: LOW / FUTURE**

| Task | File | Complexity |
|------|------|------------|
| Visibility state spoofing | preload or utility | Medium |
| HEVC codec detection | `hls-playlist-parser.ts` | High |
| Full ad segment stripping | Custom HLS loader | High |

---

## Summary

### What We're Adding

1. **Resolution Matching** - Backup streams match current quality
2. **Prefetch Stripping** - Prevents ad segment pre-loading
3. **Smart Caching** - Faster backup selection on repeat ads
4. **Buffering Recovery** - Auto-fix stuck playback
5. **Minimal Requests Mode** - Reduce API load after reload

### What We're Deferring

1. **Visibility Spoofing** - Nice-to-have for background playback
2. **HEVC Handling** - Only needed for 2K/4K streams
3. **Full Segment Stripping** - Complex, current hide approach works

### Success Criteria

- [ ] Backup streams match user's selected quality level
- [ ] No ad frames visible before blocking (prefetch stripped)
- [ ] Second ad break loads faster than first (caching works)
- [ ] Stuck playback auto-recovers within 2 seconds
- [ ] Post-reload ad handling is responsive

---

## References

- **VAFT Script:** `twitchadblockscript.md` (v32.0.0)
- **Original Repository:** https://github.com/pixeltris/TwitchAdSolutions
- **Xtra Implementation:** Covered in `twitch-adblock-xtra-spec.md`
- **Current Implementation:** `src/backend/adblock/`, `src/hooks/useAdBlock.ts`
