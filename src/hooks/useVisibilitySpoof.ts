/**
 * useVisibilitySpoof Hook
 *
 * React hook for managing visibility state spoofing in player components.
 * Enables background playback by preventing the browser from detecting
 * that the window has lost focus.
 *
 * Usage:
 * ```tsx
 * function Player() {
 *   const { enabled, toggle, stats } = useVisibilitySpoof({
 *     autoEnable: true,
 *   });
 *   
 *   return (
 *     <button onClick={toggle}>
 *       {enabled ? 'Disable' : 'Enable'} Background Playback
 *       (Blocked: {stats.blockedEvents})
 *     </button>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    enableVisibilitySpoof,
    disableVisibilitySpoof,
    isVisibilitySpoofEnabled,
    getBlockedEventCount,
} from '@/utils/visibility-spoof';

/**
 * Options for the visibility spoof hook
 */
export interface UseVisibilitySpoofOptions {
    /**
     * Whether to automatically enable spoofing when the component mounts.
     * Default: false
     */
    autoEnable?: boolean;

    /**
     * Whether spoofing should be enabled based on external state.
     * Useful for connecting to user preferences.
     */
    externalEnabled?: boolean;

    /**
     * Callback when spoofing is enabled
     */
    onEnable?: () => void;

    /**
     * Callback when spoofing is disabled
     */
    onDisable?: () => void;

    /**
     * Callback when a visibility change event is blocked
     */
    onEventBlocked?: (totalBlocked: number) => void;
}

/**
 * Stats about visibility spoofing
 */
export interface VisibilitySpoofStats {
    /** Number of visibility change events blocked */
    blockedEvents: number;
    /** Time when spoofing was enabled (or null if never) */
    enabledAt: number | null;
    /** Duration spoofing has been active in milliseconds */
    activeDuration: number;
}

/**
 * Return type for the visibility spoof hook
 */
export interface UseVisibilitySpoofReturn {
    /** Whether visibility spoofing is currently enabled */
    enabled: boolean;
    /** Enable visibility spoofing */
    enable: () => boolean;
    /** Disable visibility spoofing */
    disable: () => boolean;
    /** Toggle visibility spoofing */
    toggle: () => boolean;
    /** Set enabled state */
    setEnabled: (enabled: boolean) => boolean;
    /** Current stats */
    stats: VisibilitySpoofStats;
}

/**
 * Hook for managing visibility state spoofing.
 *
 * @param options - Configuration options
 * @returns Object with control functions and state
 */
export function useVisibilitySpoof(
    options: UseVisibilitySpoofOptions = {}
): UseVisibilitySpoofReturn {
    const {
        autoEnable = false,
        externalEnabled,
        onEnable,
        onDisable,
        onEventBlocked,
    } = options;

    const [enabled, setEnabledState] = useState<boolean>(isVisibilitySpoofEnabled);
    const [stats, setStats] = useState<VisibilitySpoofStats>({
        blockedEvents: 0,
        enabledAt: null,
        activeDuration: 0,
    });

    const enabledAtRef = useRef<number | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Update stats periodically when enabled
    useEffect(() => {
        if (enabled) {
            intervalRef.current = setInterval(() => {
                const blockedEvents = getBlockedEventCount();
                const now = Date.now();
                const activeDuration = enabledAtRef.current
                    ? now - enabledAtRef.current
                    : 0;

                setStats(prev => {
                    // Only update if values changed
                    if (
                        prev.blockedEvents !== blockedEvents ||
                        Math.abs(prev.activeDuration - activeDuration) > 1000
                    ) {
                        if (onEventBlocked && blockedEvents > prev.blockedEvents) {
                            onEventBlocked(blockedEvents);
                        }

                        return {
                            blockedEvents,
                            enabledAt: enabledAtRef.current,
                            activeDuration,
                        };
                    }
                    return prev;
                });
            }, 1000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, onEventBlocked]);

    // Handle auto-enable on mount
    useEffect(() => {
        if (autoEnable && !isVisibilitySpoofEnabled()) {
            enableVisibilitySpoof();
            setEnabledState(true);
            enabledAtRef.current = Date.now();
            onEnable?.();
        }

        // Cleanup on unmount - only if we auto-enabled
        return () => {
            if (autoEnable && isVisibilitySpoofEnabled()) {
                disableVisibilitySpoof();
            }
        };
    }, [autoEnable, onEnable]);

    // Handle external enabled prop changes
    useEffect(() => {
        if (externalEnabled !== undefined && externalEnabled !== isVisibilitySpoofEnabled()) {
            if (externalEnabled) {
                enableVisibilitySpoof();
                enabledAtRef.current = Date.now();
                onEnable?.();
            } else {
                disableVisibilitySpoof();
                enabledAtRef.current = null;
                onDisable?.();
            }
            setEnabledState(externalEnabled);
        }
    }, [externalEnabled, onEnable, onDisable]);

    const enable = useCallback((): boolean => {
        if (isVisibilitySpoofEnabled()) {
            return true;
        }

        const success = enableVisibilitySpoof();
        if (success) {
            setEnabledState(true);
            enabledAtRef.current = Date.now();
            setStats({
                blockedEvents: 0,
                enabledAt: enabledAtRef.current,
                activeDuration: 0,
            });
            onEnable?.();
        }
        return success;
    }, [onEnable]);

    const disable = useCallback((): boolean => {
        if (!isVisibilitySpoofEnabled()) {
            return true;
        }

        const success = disableVisibilitySpoof();
        if (success) {
            setEnabledState(false);
            enabledAtRef.current = null;
            onDisable?.();
        }
        return success;
    }, [onDisable]);

    const toggle = useCallback((): boolean => {
        return isVisibilitySpoofEnabled() ? disable() : enable();
    }, [enable, disable]);

    const setEnabled = useCallback(
        (value: boolean): boolean => {
            return value ? enable() : disable();
        },
        [enable, disable]
    );

    return {
        enabled,
        enable,
        disable,
        toggle,
        setEnabled,
        stats,
    };
}
