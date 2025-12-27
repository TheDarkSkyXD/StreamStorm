/**
 * useBufferingRecovery Hook
 * 
 * VAFT Phase 3: Player Stability
 * 
 * Detects stuck playback (buffering issues) and automatically recovers
 * by refreshing the HLS stream. This is especially important during
 * ad-blocking transitions where the stream might stall.
 * 
 * Based on TwitchAdSolutions VAFT buffering detection logic.
 * 
 * Detection algorithm:
 * 1. Monitor playback position and buffer state every 500ms
 * 2. If position hasn't changed AND buffer is low (<1s) for 3 consecutive checks
 * 3. Trigger stream refresh via HLS
 * 4. Wait 5s before allowing another recovery attempt
 */

import { useEffect, useRef, useCallback } from 'react';
import type Hls from 'hls.js';

// ========== Types ==========

/**
 * Internal state for tracking playback progress.
 */
interface BufferingState {
    /** Last recorded playback position */
    position: number;
    /** Last recorded buffer end position */
    bufferedPosition: number;
    /** Last recorded buffer duration (bufferEnd - position) */
    bufferDuration: number;
    /** Count of consecutive stuck states detected */
    sameStateCount: number;
    /** Timestamp of last recovery attempt */
    lastFixTime: number;
}

/**
 * Options for configuring the buffering recovery behavior.
 */
export interface UseBufferingRecoveryOptions {
    /** Whether buffering recovery is enabled. Default: true */
    enabled?: boolean;
    /** Interval between buffer checks in ms. Default: 500 */
    checkIntervalMs?: number;
    /** Number of consecutive stuck states before triggering recovery. Default: 3 */
    sameStateThreshold?: number;
    /** Buffer duration (in seconds) below which is considered dangerous. Default: 1 */
    dangerZoneSeconds?: number;
    /** Minimum time between recovery attempts in ms. Default: 5000 */
    minRepeatDelayMs?: number;
    /** Callback when stream refresh is triggered */
    onRecovery?: () => void;
    /** Callback when stuck state is detected (before recovery) */
    onStuckDetected?: (state: { position: number; bufferDuration: number; sameStateCount: number }) => void;
}

/**
 * Return value from the useBufferingRecovery hook.
 */
export interface UseBufferingRecoveryResult {
    /** Number of recoveries triggered in this session */
    recoveryCount: number;
    /** Whether currently in stuck state */
    isStuck: boolean;
    /** Current buffer duration in seconds */
    bufferDuration: number;
    /** Manually trigger recovery */
    triggerRecovery: () => void;
    /** Reset the recovery state (call on stream change) */
    resetState: () => void;
}

// ========== Default Options ==========

const DEFAULT_OPTIONS: Required<Omit<UseBufferingRecoveryOptions, 'onRecovery' | 'onStuckDetected'>> = {
    enabled: true,
    checkIntervalMs: 500,
    sameStateThreshold: 3,
    dangerZoneSeconds: 1,
    minRepeatDelayMs: 5000,
};

// ========== Hook Implementation ==========

/**
 * Hook for detecting and recovering from stuck playback/buffering issues.
 * 
 * @param videoRef - Ref to the HTMLVideoElement
 * @param hlsRef - Ref to the HLS.js instance (optional, for HLS recovery mode)
 * @param isAdBlocking - Whether ad blocking is currently active (skip checks during ads)
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * const { recoveryCount, isStuck, triggerRecovery } = useBufferingRecovery(
 *     videoRef,
 *     hlsRef,
 *     isBlockingAds,
 *     { 
 *         onRecovery: (method) => console.log(`Recovered via ${method}`),
 *         dangerZoneSeconds: 0.5 
 *     }
 * );
 * ```
 */
export function useBufferingRecovery(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    hlsRef: React.RefObject<Hls | null>,
    isAdBlocking: boolean,
    options: UseBufferingRecoveryOptions = {}
): UseBufferingRecoveryResult {
    // Merge options with defaults
    const {
        enabled = DEFAULT_OPTIONS.enabled,
        checkIntervalMs = DEFAULT_OPTIONS.checkIntervalMs,
        sameStateThreshold = DEFAULT_OPTIONS.sameStateThreshold,
        dangerZoneSeconds = DEFAULT_OPTIONS.dangerZoneSeconds,
        minRepeatDelayMs = DEFAULT_OPTIONS.minRepeatDelayMs,
        onRecovery,
        onStuckDetected,
    } = options;

    // Internal state ref (not reactive to avoid re-renders on every check)
    const stateRef = useRef<BufferingState>({
        position: 0,
        bufferedPosition: 0,
        bufferDuration: 0,
        sameStateCount: 0,
        lastFixTime: 0,
    });

    // Reactive state for external consumers
    const recoveryCountRef = useRef(0);
    const isStuckRef = useRef(false);
    const bufferDurationRef = useRef(0);

    // Force update mechanism for reactive values
    const forceUpdateRef = useRef(0);

    /**
     * Perform recovery action - refreshes the stream via HLS.
     */
    const performRecovery = useCallback(() => {
        const hls = hlsRef.current;
        const state = stateRef.current;

        // Check cooldown
        if (Date.now() - state.lastFixTime < minRepeatDelayMs) {
            console.log('[BufferingRecovery] Skipping recovery (cooldown active)');
            return;
        }

        console.log('[BufferingRecovery] Refreshing stream...');

        if (hls) {
            // Refresh the stream by triggering HLS to reload
            try {
                // First try recoverMediaError which is less disruptive
                hls.recoverMediaError();
                console.log('[BufferingRecovery] Stream refreshed via HLS recovery');
            } catch (error) {
                console.warn('[BufferingRecovery] HLS recovery failed, restarting load:', error);
                // Fall back to restarting the load
                try {
                    hls.startLoad();
                    console.log('[BufferingRecovery] Stream refreshed via startLoad');
                } catch (e) {
                    console.error('[BufferingRecovery] Failed to restart load:', e);
                }
            }
            onRecovery?.();
        } else {
            console.warn('[BufferingRecovery] No HLS instance available for recovery');
        }

        // Update state
        state.lastFixTime = Date.now();
        state.sameStateCount = 0;
        recoveryCountRef.current++;
        isStuckRef.current = false;
        forceUpdateRef.current++;
    }, [hlsRef, minRepeatDelayMs, onRecovery]);

    /**
     * Reset state - call when stream changes.
     */
    const resetState = useCallback(() => {
        stateRef.current = {
            position: 0,
            bufferedPosition: 0,
            bufferDuration: 0,
            sameStateCount: 0,
            lastFixTime: 0,
        };
        recoveryCountRef.current = 0;
        isStuckRef.current = false;
        bufferDurationRef.current = 0;
        console.log('[BufferingRecovery] State reset');
    }, []);

    // Main monitoring effect
    useEffect(() => {
        // Skip if disabled or during ad blocking
        if (!enabled || isAdBlocking) {
            return;
        }

        const checkBuffering = () => {
            const video = videoRef.current;
            if (!video || video.paused || video.ended) {
                return;
            }

            const state = stateRef.current;
            const position = video.currentTime;

            // Calculate buffer duration
            const bufferEnd = video.buffered.length > 0
                ? video.buffered.end(video.buffered.length - 1)
                : 0;
            const bufferDuration = bufferEnd - position;

            // Update reactive buffer duration
            bufferDurationRef.current = bufferDuration;

            // Check if playback appears stuck:
            // - Position hasn't changed OR buffer is critically low
            // - Buffer end hasn't changed
            // - Buffer isn't growing
            // - We're past the recovery cooldown
            const positionStuck = position > 0 && state.position === position;
            const bufferLow = bufferDuration < dangerZoneSeconds;
            const bufferNotGrowing = state.bufferedPosition >= bufferEnd;
            const bufferShrinking = state.bufferDuration >= bufferDuration;
            const pastCooldown = Date.now() - state.lastFixTime > minRepeatDelayMs;

            const isStuck = (
                (positionStuck || bufferLow) &&
                bufferNotGrowing &&
                bufferShrinking &&
                pastCooldown
            );

            if (isStuck) {
                state.sameStateCount++;
                isStuckRef.current = true;

                // Notify about stuck state
                onStuckDetected?.({
                    position,
                    bufferDuration,
                    sameStateCount: state.sameStateCount,
                });

                // Check if we've hit the threshold
                if (state.sameStateCount >= sameStateThreshold) {
                    console.log(
                        `[BufferingRecovery] Stuck detected: pos=${position.toFixed(2)}s, ` +
                        `buffer=${bufferDuration.toFixed(2)}s, count=${state.sameStateCount}`
                    );
                    performRecovery();
                }
            } else {
                // Not stuck, reset counter
                if (state.sameStateCount > 0) {
                    state.sameStateCount = 0;
                    isStuckRef.current = false;
                }
            }

            // Update state for next check
            state.position = position;
            state.bufferedPosition = bufferEnd;
            state.bufferDuration = bufferDuration;
        };

        // Start monitoring
        const intervalId = setInterval(checkBuffering, checkIntervalMs);
        console.log(`[BufferingRecovery] Started monitoring (interval: ${checkIntervalMs}ms)`);

        return () => {
            clearInterval(intervalId);
            console.log('[BufferingRecovery] Stopped monitoring');
        };
    }, [
        enabled,
        isAdBlocking,
        checkIntervalMs,
        sameStateThreshold,
        dangerZoneSeconds,
        minRepeatDelayMs,
        videoRef,
        onStuckDetected,
        performRecovery,
    ]);

    return {
        recoveryCount: recoveryCountRef.current,
        isStuck: isStuckRef.current,
        bufferDuration: bufferDurationRef.current,
        triggerRecovery: performRecovery,
        resetState,
    };
}

export default useBufferingRecovery;
