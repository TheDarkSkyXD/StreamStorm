# Twitch Ad-Blocker Enhancement Plan

**Created:** 2026-01-11
**Status:** Planning Complete
**Objective:** Implement VAFT-inspired ad-blocking with main process manifest proxy for seamless, network-transparent ad replacement.

---

## Overview

Build a comprehensive Twitch ad-blocking solution directly into StreamStorm's Electron app by:
1. Enhancing the existing VAFT-based renderer service
2. Adding a main process manifest proxy for network-level interception
3. Implementing 160p segment replacement strategy
4. Adding robust ad detection heuristics

**Key Success Metrics:**
- Zero visible ads (>95% streams)
- Quality degradation <2s total per ad break
- No "Commercial Break in Progress" screen
- Seamless playback without stalls

---

## Phase 1: Enhance Existing Ad-Block Service

**Goal:** Improve the existing `twitch-adblock-service.ts` with missing VAFT features.

### Task 1.1: Add Missing GQL Headers
**File:** `src/components/player/twitch/twitch-adblock-service.ts`
**Parallelizable:** NO (foundational change)

Add `Client-Version` and `Client-Session-Id` headers to GQL requests for better Twitch API compatibility.

**Implementation:**
```typescript
// In gqlRequest() function, add:
let headers: Record<string, string> = {
    'Client-ID': config.clientId,
    'X-Device-Id': gqlDeviceId,
    'Content-Type': 'application/json',
};
if (authorizationHeader) headers['Authorization'] = authorizationHeader;
if (clientIntegrityHeader) headers['Client-Integrity'] = clientIntegrityHeader;
if (clientVersion) headers['Client-Version'] = clientVersion;  // NEW
if (clientSession) headers['Client-Session-Id'] = clientSession;  // NEW
```

**Acceptance Criteria:**
- [ ] `clientVersion` and `clientSession` state variables added
- [ ] `setClientHeaders()` function exposed for runtime updates
- [ ] Headers included in all GQL requests

---

### Task 1.2: Add #EXT-X-DATERANGE Ad Detection
**File:** `src/components/player/twitch/twitch-adblock-service.ts`
**Parallelizable:** YES (with 1.3)

Add primary ad detection using `#EXT-X-DATERANGE` tags which are 99% reliable.

**Implementation:**
```typescript
// In processMediaPlaylist(), add before existing hasAdTags check:
const hasDateRangeAd = text.includes('#EXT-X-DATERANGE') && 
                       (text.includes('stitched-ad') || 
                        text.includes('com.twitch.tv/ad') ||
                        text.includes('amazon-ad'));
const hasAdTags = text.includes(config.adSignifier) || hasDateRangeAd;
```

**Acceptance Criteria:**
- [ ] DATERANGE detection added as primary check
- [ ] Falls back to `stitched` signifier if DATERANGE not present
- [ ] Logs which detection method triggered

---

### Task 1.3: Improve Tracking URL Neutralization
**File:** `src/components/player/twitch/twitch-adblock-service.ts`
**Parallelizable:** YES (with 1.2)

Neutralize tracking URLs earlier in the pipeline (not just during stripping).

**Implementation:**
```typescript
// Add helper function:
function neutralizeTrackingUrls(text: string): string {
    const safeUrl = 'https://twitch.tv';
    return text
        .replace(/(X-TV-TWITCH-AD-URL=")[^"]*(")/g, `$1${safeUrl}$2`)
        .replace(/(X-TV-TWITCH-AD-CLICK-TRACKING-URL=")[^"]*(")/g, `$1${safeUrl}$2`)
        .replace(/(X-TV-TWITCH-AD-ROLL-TYPE=")[^"]*(")/g, `$1$2`);
}

// Call in processMediaPlaylist() before any ad detection
text = neutralizeTrackingUrls(text);
```

**Acceptance Criteria:**
- [ ] Tracking URLs neutralized before processing
- [ ] No tracking URLs leak to player

---

### Task 1.4: Add Bitrate Drop Detection Heuristic
**File:** `src/components/player/twitch/twitch-adblock-service.ts`
**Parallelizable:** YES (with 1.2, 1.3)

Detect ads via sudden bitrate drops (>70% reduction from normal).

**Implementation:**
```typescript
// Add to StreamInfo interface:
lastKnownBitrate: number | null;

// In processMediaPlaylist():
function detectBitrateDrop(text: string, streamInfo: StreamInfo): boolean {
    const bitrateMatch = text.match(/BANDWIDTH=(\d+)/);
    if (bitrateMatch) {
        const currentBitrate = parseInt(bitrateMatch[1], 10);
        if (streamInfo.lastKnownBitrate && 
            currentBitrate < streamInfo.lastKnownBitrate * 0.3) {
            return true; // >70% drop
        }
        if (!text.includes(config.adSignifier)) {
            streamInfo.lastKnownBitrate = currentBitrate;
        }
    }
    return false;
}
```

**Acceptance Criteria:**
- [ ] Bitrate tracking added to StreamInfo
- [ ] Drop detection integrated as secondary heuristic
- [ ] Does not false-positive on quality changes

---

### Task 1.5: Update AdBlockConfig with New Options
**File:** `src/shared/adblock-types.ts`
**Parallelizable:** NO (dependency for other tasks)

Add new configuration options for enhanced detection.

**Implementation:**
```typescript
export interface AdBlockConfig {
    // ... existing fields ...
    
    /** Use DATERANGE tags for primary ad detection */
    useDateRangeDetection: boolean;
    
    /** Use bitrate drop as secondary detection */
    useBitrateDropDetection: boolean;
    
    /** Minimum bitrate drop percentage to trigger detection (0-1) */
    bitrateDropThreshold: number;
    
    /** Enable 160p segment replacement (vs blank video) */
    use160pReplacement: boolean;
}

export const DEFAULT_ADBLOCK_CONFIG: AdBlockConfig = {
    // ... existing defaults ...
    useDateRangeDetection: true,
    useBitrateDropDetection: true,
    bitrateDropThreshold: 0.7,
    use160pReplacement: true,
};
```

**Acceptance Criteria:**
- [ ] New config options defined
- [ ] Defaults set appropriately
- [ ] Types exported correctly

---

## Phase 2: Main Process Manifest Proxy

**Goal:** Intercept HLS manifests at the Electron session level for network-transparent ad removal.

### Task 2.1: Create TwitchManifestProxy Service
**File:** `src/backend/services/twitch-manifest-proxy.ts` (NEW)
**Parallelizable:** NO (core new component)

Create the main process service that intercepts and processes Twitch HLS manifests.

**Implementation Outline:**
```typescript
/**
 * Twitch Manifest Proxy Service
 * 
 * Intercepts HLS manifest requests at the Electron session level
 * and processes them through VAFT-style ad removal before they
 * reach the renderer.
 */

import { session } from 'electron';

interface ProxyStreamInfo {
    channelName: string;
    encodingsM3u8: string | null;
    last160pSegment: string | null;
    isInAdBreak: boolean;
    usherParams: string;
    resolutions: Map<string, ResolutionInfo>;
}

class TwitchManifestProxyService {
    private streamInfos = new Map<string, ProxyStreamInfo>();
    private isEnabled = true;

    /**
     * Register the manifest interceptor with Electron's session
     */
    registerInterceptor(): void {
        session.defaultSession.webRequest.onBeforeRequest(
            {
                urls: [
                    '*://usher.ttvnw.net/*/*.m3u8*',
                    '*://video-weaver*.ttvnw.net/*.m3u8*',
                    '*://*.hls.ttvnw.net/*.m3u8*'
                ]
            },
            async (details, callback) => {
                if (!this.isEnabled) {
                    callback({});
                    return;
                }

                try {
                    const response = await fetch(details.url);
                    if (!response.ok) {
                        callback({});
                        return;
                    }

                    const originalText = await response.text();
                    const processedText = await this.processManifest(
                        details.url, 
                        originalText
                    );

                    // Return as Base64 data URL
                    const base64 = Buffer.from(processedText).toString('base64');
                    callback({
                        redirectURL: `data:application/vnd.apple.mpegurl;base64,${base64}`
                    });
                } catch (error) {
                    console.error('[ManifestProxy] Error:', error);
                    callback({});
                }
            }
        );
    }

    private async processManifest(url: string, text: string): Promise<string> {
        if (this.isMasterPlaylist(url)) {
            return this.processMasterPlaylist(url, text);
        } else {
            return this.processMediaPlaylist(url, text);
        }
    }

    // ... additional methods
}

export const twitchManifestProxy = new TwitchManifestProxyService();
```

**Acceptance Criteria:**
- [ ] Service class created with proper structure
- [ ] Interceptor registration method
- [ ] Master/media playlist detection
- [ ] Base64 data URL response format
- [ ] Error handling with passthrough fallback

---

### Task 2.2: Implement Master Playlist Processing
**File:** `src/backend/services/twitch-manifest-proxy.ts`
**Parallelizable:** NO (depends on 2.1)

Process master playlists to extract resolution info and identify 160p stream.

**Implementation:**
```typescript
private processMasterPlaylist(url: string, text: string): string {
    const channelName = this.extractChannelName(url);
    if (!channelName) return text;

    const urlObj = new URL(url);
    const streamInfo: ProxyStreamInfo = {
        channelName,
        encodingsM3u8: text,
        last160pSegment: null,
        isInAdBreak: false,
        usherParams: urlObj.search,
        resolutions: new Map()
    };

    // Parse resolutions and find 160p stream
    const lines = text.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            const attrs = this.parseAttributes(lines[i]);
            const resolution = attrs['RESOLUTION'];
            const bandwidth = parseInt(attrs['BANDWIDTH'], 10);
            
            if (resolution) {
                streamInfo.resolutions.set(lines[i + 1].trim(), {
                    resolution,
                    bandwidth,
                    codecs: attrs['CODECS'] || '',
                    frameRate: parseFloat(attrs['FRAME-RATE']) || 30
                });

                // Identify 160p stream (BANDWIDTH ~160000-350000)
                if (bandwidth >= 160000 && bandwidth <= 400000) {
                    streamInfo.baseline160pUrl = lines[i + 1].trim();
                }
            }
        }
    }

    this.streamInfos.set(channelName, streamInfo);
    return text;
}
```

**Acceptance Criteria:**
- [ ] Channel name extraction from URL
- [ ] Resolution parsing from `#EXT-X-STREAM-INF`
- [ ] 160p stream identification by bandwidth
- [ ] StreamInfo stored for later reference

---

### Task 2.3: Implement Media Playlist Processing with Ad Replacement
**File:** `src/backend/services/twitch-manifest-proxy.ts`
**Parallelizable:** NO (depends on 2.2)

Process media playlists to detect and replace ad segments.

**Implementation:**
```typescript
private async processMediaPlaylist(url: string, text: string): Promise<string> {
    const streamInfo = this.findStreamInfoByUrl(url);
    if (!streamInfo) return text;

    // Neutralize tracking URLs first
    text = this.neutralizeTrackingUrls(text);

    // Detect ads using multiple heuristics
    const hasAd = this.detectAds(text);
    
    if (hasAd) {
        if (!streamInfo.isInAdBreak) {
            streamInfo.isInAdBreak = true;
            console.debug(`[ManifestProxy] Ad detected on ${streamInfo.channelName}`);
        }

        // Try backup stream first
        const backupText = await this.tryGetBackupStream(streamInfo, url);
        if (backupText && !this.detectAds(backupText)) {
            return backupText;
        }

        // Fallback: Strip ad segments and replace with 160p
        return this.replaceAdSegments(text, streamInfo);
    } else if (streamInfo.isInAdBreak) {
        streamInfo.isInAdBreak = false;
        console.debug(`[ManifestProxy] Ad ended on ${streamInfo.channelName}`);
    }

    // Store last valid 160p segment for replacement
    this.updateBaseline160pSegment(text, streamInfo);

    return text;
}

private detectAds(text: string): boolean {
    // Primary: DATERANGE tags
    if (text.includes('#EXT-X-DATERANGE') && 
        (text.includes('stitched-ad') || text.includes('com.twitch.tv/ad'))) {
        return true;
    }
    
    // Secondary: stitched signifier
    if (text.includes('stitched')) {
        return true;
    }
    
    return false;
}
```

**Acceptance Criteria:**
- [ ] Ad detection using DATERANGE + stitched
- [ ] Backup stream attempt
- [ ] 160p segment replacement fallback
- [ ] Ad break state tracking
- [ ] Baseline segment updates

---

### Task 2.4: Implement 160p Segment Replacement Logic
**File:** `src/backend/services/twitch-manifest-proxy.ts`
**Parallelizable:** NO (depends on 2.3)

Replace ad segments with cached 160p content segments.

**Implementation:**
```typescript
private replaceAdSegments(text: string, streamInfo: ProxyStreamInfo): string {
    if (!streamInfo.last160pSegment) {
        // Fallback to blank video if no 160p available
        return this.stripAdSegmentsWithBlankVideo(text);
    }

    const lines = text.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Detect ad segment
        if (line.startsWith('#EXTINF') && i + 1 < lines.length) {
            const segmentUrl = lines[i + 1];
            const isAdSegment = !line.includes(',live') || 
                                this.isKnownAdSegment(segmentUrl);

            if (isAdSegment) {
                // Keep EXTINF but replace segment URL with 160p
                result.push(line);
                result.push(streamInfo.last160pSegment);
                i += 2;
                continue;
            }
        }

        // Remove prefetch during ads
        if (streamInfo.isInAdBreak && line.startsWith('#EXT-X-TWITCH-PREFETCH:')) {
            i++;
            continue;
        }

        result.push(line);
        i++;
    }

    return result.join('\n');
}

private updateBaseline160pSegment(text: string, streamInfo: ProxyStreamInfo): void {
    // Only update from clean (non-ad) playlists
    if (this.detectAds(text)) return;

    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith('#EXTINF') && lines[i].includes(',live')) {
            const segmentUrl = lines[i + 1]?.trim();
            if (segmentUrl && segmentUrl.startsWith('https://')) {
                streamInfo.last160pSegment = segmentUrl;
                break;
            }
        }
    }
}
```

**Acceptance Criteria:**
- [ ] Ad segments replaced with 160p content
- [ ] Fallback to blank video if no 160p cached
- [ ] EXTINF timing preserved
- [ ] Prefetch disabled during ads
- [ ] Baseline updated only from clean playlists

---

### Task 2.5: Implement Backup Stream Fetching
**File:** `src/backend/services/twitch-manifest-proxy.ts`
**Parallelizable:** NO (depends on 2.3)

Fetch ad-free backup streams using different player types.

**Implementation:**
```typescript
private readonly BACKUP_PLAYER_TYPES = ['embed', 'popout', 'autoplay', 'thunderdome'];
private readonly GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

private async tryGetBackupStream(
    streamInfo: ProxyStreamInfo, 
    originalUrl: string
): Promise<string | null> {
    for (const playerType of this.BACKUP_PLAYER_TYPES) {
        try {
            const token = await this.getAccessToken(streamInfo.channelName, playerType);
            if (!token) continue;

            const usherUrl = this.buildUsherUrl(streamInfo, token);
            const encodingsResponse = await fetch(usherUrl);
            if (!encodingsResponse.ok) continue;

            const encodingsM3u8 = await encodingsResponse.text();
            const streamUrl = this.getMatchingStreamUrl(encodingsM3u8, originalUrl, streamInfo);
            if (!streamUrl) continue;

            const mediaResponse = await fetch(streamUrl);
            if (!mediaResponse.ok) continue;

            const mediaText = await mediaResponse.text();
            
            // Check if backup is clean
            if (!this.detectAds(mediaText)) {
                console.debug(`[ManifestProxy] Using backup (${playerType})`);
                return mediaText;
            }
        } catch (error) {
            // Continue to next player type
        }
    }

    return null;
}

private async getAccessToken(
    channelName: string, 
    playerType: string
): Promise<{ signature: string; value: string } | null> {
    const body = {
        operationName: 'PlaybackAccessToken',
        variables: {
            isLive: true,
            login: channelName,
            isVod: false,
            vodID: '',
            playerType,
            platform: playerType === 'autoplay' ? 'android' : 'web'
        },
        extensions: {
            persistedQuery: {
                version: 1,
                sha256Hash: 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9'
            }
        }
    };

    const response = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
            'Client-ID': this.GQL_CLIENT_ID,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) return null;

    const data = await response.json();
    const token = data.data?.streamPlaybackAccessToken;
    
    if (!token) return null;

    // CRITICAL: Strip parent_domains to bypass embed detection
    try {
        const tokenValue = JSON.parse(token.value);
        delete tokenValue.parent_domains;
        delete tokenValue.parent_referrer_domains;
        return {
            signature: token.signature,
            value: JSON.stringify(tokenValue)
        };
    } catch {
        return token;
    }
}
```

**Acceptance Criteria:**
- [ ] Player type rotation implemented
- [ ] GQL access token fetching
- [ ] `parent_domains` stripping
- [ ] Backup stream validation (no ads)
- [ ] Graceful fallback on failure

---

### Task 2.6: Register Proxy in Main Process
**File:** `src/main.ts`
**Parallelizable:** NO (integration point)

Integrate the manifest proxy into the main process startup.

**Implementation:**
```typescript
// Add import
import { twitchManifestProxy } from './backend/services/twitch-manifest-proxy';

// In setupRequestInterceptors(), add:
function setupRequestInterceptors(): void {
    // Twitch manifest proxy (must be registered BEFORE network ad block)
    twitchManifestProxy.registerInterceptor();
    
    // Network-level ad blocking (existing)
    session.defaultSession.webRequest.onBeforeRequest(
        { urls: ['<all_urls>'] },
        (details, callback) => {
            // Skip manifest URLs (handled by proxy)
            if (details.url.includes('ttvnw.net') && details.url.includes('.m3u8')) {
                callback({});
                return;
            }
            
            const result = networkAdBlockService.shouldBlock(details.url);
            if (result.blocked) {
                callback({ cancel: true });
                return;
            }
            callback({});
        }
    );

    // ... rest of existing interceptors
}
```

**Acceptance Criteria:**
- [ ] Proxy registered before other interceptors
- [ ] Manifest URLs excluded from network block
- [ ] No conflicts with existing interceptors
- [ ] Startup order verified

---

## Phase 3: Renderer Integration & Fallback Layer

**Goal:** Update renderer-side service to work as backup layer when main process proxy is active.

### Task 3.1: Add Proxy Detection in Renderer Service
**File:** `src/components/player/twitch/twitch-adblock-service.ts`
**Parallelizable:** YES (with 3.2)

Detect when main process proxy is active and reduce redundant processing.

**Implementation:**
```typescript
// Add to module state
let isMainProcessProxyActive = false;

export function setMainProcessProxyActive(active: boolean): void {
    isMainProcessProxyActive = active;
    console.debug(`[AdBlock] Main process proxy: ${active ? 'active' : 'inactive'}`);
}

// In processMediaPlaylist(), add early return:
export async function processMediaPlaylist(url: string, text: string): Promise<string> {
    if (!config.enabled) return text;
    
    // If main process proxy is handling ads, just do minimal tracking
    if (isMainProcessProxyActive) {
        // Still track ad state for UI updates
        updateAdStateFromPlaylist(text);
        return text;
    }
    
    // ... existing full processing
}
```

**Acceptance Criteria:**
- [ ] Proxy detection flag added
- [ ] Redundant processing skipped when proxy active
- [ ] UI state updates still work
- [ ] Fallback to full processing when proxy inactive

---

### Task 3.2: Update HLS Loaders for Dual-Layer Operation
**File:** `src/components/player/twitch/twitch-adblock-loader.ts`
**Parallelizable:** YES (with 3.1)

Update loaders to work as backup when proxy is primary.

**Implementation:**
```typescript
// In AdBlockLoader.load():
load(context: any, config: any, callbacks: any): void {
    const url: string = context.url;

    // If ad-blocking is disabled, pass through directly
    if (!isAdBlockEnabled()) {
        super.load(context, config, callbacks);
        return;
    }

    // For m3u8 files: Check if already processed by main proxy
    if (url.startsWith('data:application/vnd.apple.mpegurl')) {
        // Already processed by main process - just decode and pass through
        console.debug('[AdBlockLoader] Using pre-processed manifest');
        super.load(context, config, callbacks);
        return;
    }

    // ... existing processing for non-proxied requests
}
```

**Acceptance Criteria:**
- [ ] Data URL detection added
- [ ] Pre-processed manifests passed through
- [ ] Logging for debugging
- [ ] Fragment loader still handles segment replacement

---

### Task 3.3: Add IPC Channel for Proxy Status
**File:** `src/shared/ipc-channels.ts` + handlers
**Parallelizable:** YES (with 3.1, 3.2)

Add IPC channel to communicate proxy status to renderer.

**Implementation:**
```typescript
// In ipc-channels.ts, add:
ADBLOCK_PROXY_STATUS: 'adblock:proxy-status',

// In adblock-handlers.ts, add:
ipcMain.handle(IPC_CHANNELS.ADBLOCK_PROXY_STATUS, () => {
    return { 
        isActive: twitchManifestProxy.isActive(),
        stats: twitchManifestProxy.getStats()
    };
});

// In preload/index.ts, add:
proxyStatus: () => ipcRenderer.invoke('adblock:proxy-status'),
```

**Acceptance Criteria:**
- [ ] IPC channel defined
- [ ] Handler returns proxy status
- [ ] Preload exposes to renderer
- [ ] Stats included for debugging

---

## Phase 4: Testing & Validation

**Goal:** Verify the ad-blocking system works correctly across various scenarios.

### Task 4.1: Create Ad-Block Test Utility
**File:** `src/components/player/twitch/adblock-test-utils.ts` (NEW)
**Parallelizable:** YES

Create utility functions for testing ad detection and replacement.

**Implementation:**
```typescript
/**
 * Test utilities for Twitch ad-blocking
 */

// Sample M3U8 with ads for testing
export const SAMPLE_AD_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:12345
#EXT-X-DATERANGE:ID="stitched-ad-12345",CLASS="twitch-stitched-ad",START-DATE="2026-01-11T12:00:00Z",DURATION=30.0
#EXTINF:2.000,
https://d2vjef5jvl6bfs.cloudfront.net/ad-segment.ts
#EXTINF:2.000,live
https://video-weaver.sea01.hls.ttvnw.net/v1/segment/123.ts
`;

export const SAMPLE_CLEAN_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:12345
#EXTINF:2.000,live
https://video-weaver.sea01.hls.ttvnw.net/v1/segment/123.ts
#EXTINF:2.000,live
https://video-weaver.sea01.hls.ttvnw.net/v1/segment/124.ts
`;

export function validateM3u8Syntax(text: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!text.startsWith('#EXTM3U')) {
        errors.push('Missing #EXTM3U header');
    }
    
    const lines = text.split('\n');
    let hasMediaSequence = false;
    let hasTargetDuration = false;
    
    for (const line of lines) {
        if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) hasMediaSequence = true;
        if (line.startsWith('#EXT-X-TARGETDURATION')) hasTargetDuration = true;
    }
    
    if (!hasMediaSequence) errors.push('Missing #EXT-X-MEDIA-SEQUENCE');
    if (!hasTargetDuration) errors.push('Missing #EXT-X-TARGETDURATION');
    
    return { valid: errors.length === 0, errors };
}

export function measureAdBlockPerformance(
    processFunc: (text: string) => Promise<string>,
    iterations: number = 100
): Promise<{ avgMs: number; maxMs: number; minMs: number }> {
    // Performance measurement utility
}
```

**Acceptance Criteria:**
- [ ] Sample playlists for testing
- [ ] M3U8 validation function
- [ ] Performance measurement utility
- [ ] Export for use in dev tools

---

### Task 4.2: Add Console Logging for Ad Events
**File:** `src/components/player/twitch/twitch-adblock-service.ts`
**Parallelizable:** YES (with 4.1)

Add detailed logging for debugging ad detection and replacement.

**Implementation:**
```typescript
// Add debug logging helper
function logAdEvent(event: string, details: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
        console.debug(`[AdBlock] ${event}`, {
            timestamp: new Date().toISOString(),
            ...details
        });
    }
}

// Use throughout:
logAdEvent('Ad detected', { 
    channel: streamInfo.channelName, 
    type: streamInfo.isMidroll ? 'midroll' : 'preroll',
    detection: 'DATERANGE'
});

logAdEvent('Backup stream success', {
    channel: streamInfo.channelName,
    playerType: backupPlayerType
});

logAdEvent('160p replacement', {
    channel: streamInfo.channelName,
    segmentsReplaced: count
});
```

**Acceptance Criteria:**
- [ ] Debug logging for all ad events
- [ ] Includes timestamps and details
- [ ] Only logs in development mode
- [ ] Covers detection, backup, replacement

---

### Task 4.3: Integration Testing with Live Streams
**Parallelizable:** NO (requires all other tasks complete)

Manual testing protocol for live streams.

**Test Protocol:**
1. **High-ad channels**: Test with xQc, shroud, Pokimane (frequent ads)
2. **Quality verification**: Watch for 160p flicker duration
3. **Stall monitoring**: Time any buffering events
4. **Console review**: Verify ad detection logs
5. **M3U8 validation**: Use ffmpeg to verify syntax

**Test Cases:**
| Scenario | Expected Result | Pass Criteria |
|----------|-----------------|---------------|
| Pre-roll ad | No purple screen, brief quality dip | < 1s at 160p |
| Mid-roll ad | Seamless transition | No stall > 3s |
| HEVC stream | AVC fallback works | No codec errors |
| Long stream | Memory stable | No memory leak |
| Network drop | Graceful recovery | Auto-reconnect |

**Acceptance Criteria:**
- [ ] All test cases pass
- [ ] Performance metrics met
- [ ] No regressions in non-Twitch playback
- [ ] Memory usage stable over 2+ hours

---

## Phase 5: Documentation & Cleanup

### Task 5.1: Update AGENTS.md for Ad-Block Components
**File:** `src/components/player/twitch/AGENTS.md` (NEW)
**Parallelizable:** YES

Document the ad-blocking architecture.

**Content:**
- Component overview
- File purposes
- Configuration options
- Debugging guide
- Maintenance notes

---

### Task 5.2: Add Inline Documentation
**Files:** All modified/created files
**Parallelizable:** YES

Add JSDoc comments and inline explanations for complex logic.

---

## Dependencies & Order

```
Phase 1 (Enhance Service):
  1.5 → 1.1 → (1.2 ∥ 1.3 ∥ 1.4)
  
Phase 2 (Main Process Proxy):
  2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6
  
Phase 3 (Renderer Integration):
  (3.1 ∥ 3.2 ∥ 3.3)
  
Phase 4 (Testing):
  (4.1 ∥ 4.2) → 4.3
  
Phase 5 (Documentation):
  (5.1 ∥ 5.2)

Overall: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Twitch API changes | Monitor TwitchAdSolutions repo weekly |
| DATERANGE format changes | Keep stitched signifier as fallback |
| Performance impact | Benchmark manifest processing < 10ms |
| Memory leaks | Clear StreamInfo on stream end |
| Base64 encoding issues | Test with special characters in URLs |

---

## Success Criteria

- [ ] Zero "Commercial Break in Progress" screens
- [ ] Quality flicker < 2s per ad break
- [ ] No playback stalls > 3s
- [ ] Ad detection rate > 95%
- [ ] Memory usage stable
- [ ] All TypeScript compiles without errors
- [ ] No runtime errors in console
