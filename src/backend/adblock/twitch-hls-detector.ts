/**
 * Twitch HLS Ad Detection Module
 *
 * Provides utilities to monitor HLS.js events for real-time ad detection.
 * Based on Xtra's ExoPlayerFragment.kt implementation.
 *
 * This module works by:
 * 1. Listening to HLS.js FRAG_LOADED events for segment-level detection
 * 2. Listening to HLS.js LEVEL_LOADED events for manifest-level detection
 * 3. Parsing manifest content for EXT-X-DATERANGE ad markers
 * 4. Tracking ad timing to know when ads end
 */

import Hls from 'hls.js';
import type { LevelLoadedData, FragLoadedData } from 'hls.js';
import type { AdDetectionResult } from './hls-playlist-parser';

// ========== Types ==========

/**
 * Information about a detected ad break
 */
export interface AdBreakInfo {
    /** Whether an ad is currently playing */
    isAdPlaying: boolean;
    /** Unique ID of the current ad (if available) */
    adId?: string;
    /** Estimated duration of the ad in milliseconds */
    adDurationMs?: number;
    /** Estimated remaining time in milliseconds */
    remainingMs?: number;
    /** Timestamp when the ad started */
    startTime?: number;
    /** Detection method used */
    detectionMethod: 'none' | 'segment_title' | 'daterange' | 'manifest_scan';
    /** Number of ad segments detected */
    segmentCount?: number;
}

/**
 * Callbacks for ad detection events
 */
export interface AdDetectionCallbacks {
    /** Called when an ad break starts */
    onAdStart?: (info: AdBreakInfo) => void;
    /** Called when an ad break ends */
    onAdEnd?: () => void;
    /** Called on each manifest/level load with ad detection status */
    onManifestParsed?: (hasAds: boolean) => void;
    /** Called on each fragment with detection result */
    onFragmentChecked?: (result: AdDetectionResult) => void;
}

/**
 * State tracked internally for ad detection
 */
interface AdDetectionState {
    isAdPlaying: boolean;
    currentAdInfo: AdBreakInfo | null;
    // Debounce ad-end to prevent flickering between ad segments
    adEndTimeoutId: ReturnType<typeof setTimeout> | null;
}

// ========== Constants ==========

/**
 * Delay before declaring an ad has ended (prevents flickering)
 */
const AD_END_DEBOUNCE_MS = 2000;

// ========== Main Class ==========

/**
 * Twitch Ad Detection Monitor
 *
 * Attaches to an HLS.js instance to monitor for ad markers in real-time.
 * Uses the manifest parser to detect EXT-X-DATERANGE tags and segment titles.
 */
export class TwitchAdDetector {
    private hls: Hls | null = null;
    private callbacks: AdDetectionCallbacks;
    private state: AdDetectionState = {
        isAdPlaying: false,
        currentAdInfo: null,
        adEndTimeoutId: null,
    };

    // Track sequence numbers of known ad segments from manifest
    private adSegmentSNs: Set<number> = new Set();


    // Bound event handlers for proper cleanup
    private boundOnLevelLoaded: (event: string, data: LevelLoadedData) => void;
    private boundOnFragLoaded: (event: string, data: FragLoadedData) => void;

    constructor(callbacks: AdDetectionCallbacks = {}) {
        this.callbacks = callbacks;
        this.boundOnLevelLoaded = this.onLevelLoaded.bind(this);
        this.boundOnFragLoaded = this.onFragLoaded.bind(this);
    }

    /**
     * Attach to an HLS.js instance to start monitoring
     */
    attach(hls: Hls): void {
        this.detach(); // Clean up any previous instance
        this.hls = hls;

        // Subscribe to HLS.js events using the proper Events enum
        hls.on(Hls.Events.LEVEL_LOADED, this.boundOnLevelLoaded);
        hls.on(Hls.Events.FRAG_LOADED, this.boundOnFragLoaded);

        console.log('[TwitchAdDetector] Attached to HLS instance');
    }

    /**
     * Detach from the current HLS.js instance
     */
    detach(): void {
        if (this.hls) {
            this.hls.off(Hls.Events.LEVEL_LOADED, this.boundOnLevelLoaded);
            this.hls.off(Hls.Events.FRAG_LOADED, this.boundOnFragLoaded);
            this.hls = null;
        }

        // Clear any pending timeout
        if (this.state.adEndTimeoutId) {
            clearTimeout(this.state.adEndTimeoutId);
            this.state.adEndTimeoutId = null;
        }

        // Reset state
        this.state = {
            isAdPlaying: false,
            currentAdInfo: null,
            adEndTimeoutId: null,
        };
        this.adSegmentSNs.clear();


        console.log('[TwitchAdDetector] Detached from HLS instance');
    }

    /**
     * Handle level loaded event (manifest update)
     */
    private onLevelLoaded(_event: string, data: LevelLoadedData): void {
        // HLS.js provides the raw playlist text in data.details
        // We need to reconstruct it from the level data or use a custom approach
        // For now, we'll check if the level details contain ad markers

        try {
            const details = data.details;
            if (!details) return;

            // Check fragments for ad indicators
            let hasAds = false;
            let adSegmentCount = 0;

            // Prune SNs that have fallen out of the playlist window
            // This ensures we don't lose ad status for segments that are buffered but no longer in the manifest
            if (details.startSN !== undefined) {
                const startSN = details.startSN;
                for (const sn of this.adSegmentSNs) {
                    if (sn < startSN) {
                        this.adSegmentSNs.delete(sn);
                    }
                }
            }



            for (const frag of details.fragments || []) {
                let fragIsAd = false;

                // Check fragment title for ad network identifiers
                if (frag.title) {
                    const title = frag.title;
                    if (title.includes('Amazon') || title.includes('Adform') || title.includes('DCM')) {
                        hasAds = true;
                        fragIsAd = true;
                    }
                }

                // Check tagList for EXT-X-DATERANGE if available (skip if already identified as ad)
                // @ts-ignore - tagList may exist on fragment
                const tagList = frag.tagList as string[][] | undefined;
                if (!fragIsAd && tagList) {
                    for (const tag of tagList) {
                        if (tag[0] === 'EXT-X-DATERANGE') {
                            const tagLine = tag.join(':');
                            if (
                                tagLine.includes('stitched-ad-') ||
                                tagLine.includes('twitch-stitched-ad') ||
                                tagLine.includes('X-TV-TWITCH-AD-') ||
                                tagLine.includes('com.apple.hls.interstitial')
                            ) {
                                hasAds = true;
                                fragIsAd = true;
                                break;
                            }
                        }
                    }
                }

                if (fragIsAd) {
                    adSegmentCount++;
                    if (typeof frag.sn === 'number') {
                        this.adSegmentSNs.add(frag.sn);
                    }
                }

            }

            // Notify callback
            this.callbacks.onManifestParsed?.(hasAds);

            // If we detect ads in the manifest, we might want to inform the system,
            // but we shouldn't trigger 'isAdPlaying' state changes until the
            // player actively loads/processes the ad fragment (in onFragLoaded).
            //
            // Previously, this triggered 'Ad started: manifest_scan' immediately
            // when an ad appeared in the lookahead window, causing flapping/spamming
            // as onFragLoaded (checking current playback) would immediately end it
            // if the current fragment wasn't yet the ad.
        } catch (error) {
            console.error('[TwitchAdDetector] Error parsing level data:', error);
        }
    }

    /**
     * Handle fragment loaded event
     */
    private onFragLoaded(_event: string, data: FragLoadedData): void {
        const frag = data.frag;
        if (!frag) return;

        let isAd = false;
        let detectionMethod: AdBreakInfo['detectionMethod'] = 'none';

        // 1. Check if this fragment SN was identified as an ad in the manifest
        if (typeof frag.sn === 'number' && this.adSegmentSNs.has(frag.sn)) {
            isAd = true;
            detectionMethod = 'manifest_scan'; // Confirmed via manifest SN
        }

        // 2. Check fragment title for ad network identifiers
        if (!isAd && frag.title) {

            const title = frag.title;
            if (title.includes('Amazon') || title.includes('Adform') || title.includes('DCM')) {
                isAd = true;
                detectionMethod = 'segment_title';
            }
        }

        // 2. Check tagList for EXT-X-DATERANGE
        // @ts-ignore - tagList may exist
        const tagList = frag.tagList as string[][] | undefined;
        if (!isAd && tagList) {
            for (const tag of tagList) {
                if (tag[0] === 'EXT-X-DATERANGE') {
                    const tagLine = tag.join(':');
                    if (
                        tagLine.includes('stitched-ad-') ||
                        tagLine.includes('twitch-stitched-ad') ||
                        tagLine.includes('X-TV-TWITCH-AD-') ||
                        tagLine.includes('com.apple.hls.interstitial')
                    ) {
                        isAd = true;
                        detectionMethod = 'daterange';
                        break;
                    }
                }
            }
        }

        // Create detection result for callback
        const result: AdDetectionResult = {
            isAd,
            reason: isAd ? (detectionMethod === 'segment_title' ? 'segment_title' : 'daterange_id') : 'none',
        };

        this.callbacks.onFragmentChecked?.(result);

        // State management
        if (isAd) {
            // Cancel any pending ad-end timeout
            if (this.state.adEndTimeoutId) {
                clearTimeout(this.state.adEndTimeoutId);
                this.state.adEndTimeoutId = null;
            }

            if (!this.state.isAdPlaying) {
                this.triggerAdStart({
                    isAdPlaying: true,
                    detectionMethod,
                    adDurationMs: frag.duration ? frag.duration * 1000 : undefined,
                });
            }
        } else {
            // No ad in this fragment, but might still be in ad break
            // Schedule ad end with debounce
            if (this.state.isAdPlaying) {
                this.scheduleAdEnd();
            }
        }
    }

    /**
     * Trigger ad start and notify callback
     */
    private triggerAdStart(info: AdBreakInfo): void {
        // Cancel any pending ad-end
        if (this.state.adEndTimeoutId) {
            clearTimeout(this.state.adEndTimeoutId);
            this.state.adEndTimeoutId = null;
        }

        this.state.isAdPlaying = true;
        this.state.currentAdInfo = {
            ...info,
            startTime: Date.now(),
        };

        console.log(`[TwitchAdDetector] Ad started: method=${info.detectionMethod} est_duration=${info.adDurationMs ?? 'unknown'}ms`);

        this.callbacks.onAdStart?.(this.state.currentAdInfo);
    }

    /**
     * Schedule ad end with debounce to prevent flickering
     */
    private scheduleAdEnd(): void {
        // Don't schedule if already scheduled
        if (this.state.adEndTimeoutId) return;

        this.state.adEndTimeoutId = setTimeout(() => {
            // Capture info before clearing state
            const startTime = this.state.currentAdInfo?.startTime;
            const duration = startTime ? Date.now() - startTime : 0;

            this.state.isAdPlaying = false;
            this.state.currentAdInfo = null;
            this.state.adEndTimeoutId = null;

            console.log(`[TwitchAdDetector] Ad ended. Actual duration: ${duration}ms`);

            this.callbacks.onAdEnd?.();
        }, AD_END_DEBOUNCE_MS);
    }

    /**
     * Get current ad state
     */
    getAdState(): AdBreakInfo {
        return this.state.currentAdInfo || {
            isAdPlaying: false,
            detectionMethod: 'none',
        };
    }

    /**
     * Check if currently in an ad break
     */
    isInAdBreak(): boolean {
        return this.state.isAdPlaying;
    }

    /**
     * Manually trigger ad state (for external signals or testing)
     */
    setAdState(isAd: boolean, info?: Partial<AdBreakInfo>): void {
        if (isAd) {
            this.triggerAdStart({
                isAdPlaying: true,
                detectionMethod: info?.detectionMethod || 'none',
                adDurationMs: info?.adDurationMs,
                adId: info?.adId,
            });
        } else {
            // Immediate end without debounce
            if (this.state.adEndTimeoutId) {
                clearTimeout(this.state.adEndTimeoutId);
                this.state.adEndTimeoutId = null;
            }
            const wasPlaying = this.state.isAdPlaying;
            this.state.isAdPlaying = false;
            this.state.currentAdInfo = null;
            if (wasPlaying) {
                this.callbacks.onAdEnd?.();
            }
        }
    }
}

// ========== Factory Function ==========

/**
 * Create a new TwitchAdDetector instance
 */
export function createTwitchAdDetector(callbacks?: AdDetectionCallbacks): TwitchAdDetector {
    return new TwitchAdDetector(callbacks);
}

// ========== Hook-Style Integration ==========

/**
 * Attach ad detection to an HLS.js instance with callbacks
 * Returns a cleanup function
 */
export function attachAdDetection(
    hls: Hls,
    callbacks: AdDetectionCallbacks
): () => void {
    const detector = createTwitchAdDetector(callbacks);
    detector.attach(hls);

    return () => {
        detector.detach();
    };
}
