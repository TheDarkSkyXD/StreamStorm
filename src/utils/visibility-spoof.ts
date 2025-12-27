/**
 * Visibility State Spoofing Utility
 *
 * Prevents the player from pausing when the window loses focus.
 * This is useful for:
 * - Picture-in-Picture playback
 * - Background audio listening
 * - Multi-monitor setups where user is working in another window
 *
 * Based on VAFT onContentLoaded (lines 971-1027)
 */

/**
 * State tracking for visibility spoofing
 */
interface VisibilityState {
    enabled: boolean;
    originalVisibilityState?: PropertyDescriptor;
    originalHidden?: PropertyDescriptor;
    blockedEventCount: number;
}

const state: VisibilityState = {
    enabled: false,
    blockedEventCount: 0,
};

/**
 * Enable visibility state spoofing to prevent pause on focus loss.
 * Overrides document.visibilityState and document.hidden to always return 'visible' and false.
 * Also blocks visibilitychange events from propagating.
 *
 * @returns true if spoofing was successfully enabled, false otherwise
 */
export function enableVisibilitySpoof(): boolean {
    if (state.enabled) {
        console.log('[VisibilitySpoof] Already enabled');
        return true;
    }

    try {
        // Store original property descriptors for later restoration
        state.originalVisibilityState = Object.getOwnPropertyDescriptor(
            Document.prototype,
            'visibilityState'
        );
        state.originalHidden = Object.getOwnPropertyDescriptor(
            Document.prototype,
            'hidden'
        );

        // Override visibilityState to always return 'visible'
        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible',
            configurable: true,
        });

        // Override hidden to always return false
        Object.defineProperty(document, 'hidden', {
            get: () => false,
            configurable: true,
        });

        // Block visibility change events
        document.addEventListener('visibilitychange', blockVisibilityEvent, true);
        document.addEventListener('webkitvisibilitychange', blockVisibilityEvent, true);

        state.enabled = true;
        state.blockedEventCount = 0;

        console.log('[VisibilitySpoof] Enabled - playback will continue when window loses focus');
        return true;
    } catch (error) {
        console.warn('[VisibilitySpoof] Failed to enable:', error);
        return false;
    }
}

/**
 * Disable visibility state spoofing and restore original behavior.
 *
 * @returns true if spoofing was successfully disabled, false otherwise
 */
export function disableVisibilitySpoof(): boolean {
    if (!state.enabled) {
        console.log('[VisibilitySpoof] Already disabled');
        return true;
    }

    try {
        // Remove event listeners
        document.removeEventListener('visibilitychange', blockVisibilityEvent, true);
        document.removeEventListener('webkitvisibilitychange', blockVisibilityEvent, true);

        // Restore original property descriptors if we saved them
        if (state.originalVisibilityState) {
            Object.defineProperty(Document.prototype, 'visibilityState', state.originalVisibilityState);
            delete (document as { visibilityState?: string }).visibilityState;
        }

        if (state.originalHidden) {
            Object.defineProperty(Document.prototype, 'hidden', state.originalHidden);
            delete (document as { hidden?: boolean }).hidden;
        }

        const blockedCount = state.blockedEventCount;
        state.enabled = false;
        state.blockedEventCount = 0;

        console.log(`[VisibilitySpoof] Disabled - blocked ${blockedCount} visibility change events while active`);
        return true;
    } catch (error) {
        console.warn('[VisibilitySpoof] Failed to disable:', error);
        return false;
    }
}

/**
 * Check if visibility spoofing is currently enabled.
 */
export function isVisibilitySpoofEnabled(): boolean {
    return state.enabled;
}

/**
 * Get the number of blocked visibility change events since spoofing was enabled.
 */
export function getBlockedEventCount(): number {
    return state.blockedEventCount;
}

/**
 * Event handler that blocks visibility change events from propagating.
 */
function blockVisibilityEvent(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    state.blockedEventCount++;

    // Log occasionally to avoid spamming console
    if (state.blockedEventCount % 10 === 1) {
        console.debug(
            `[VisibilitySpoof] Blocked visibility change event (total: ${state.blockedEventCount})`
        );
    }
}

/**
 * Toggle visibility spoofing on/off.
 *
 * @param enabled - Whether to enable or disable spoofing
 * @returns true if the operation was successful
 */
export function setVisibilitySpoofEnabled(enabled: boolean): boolean {
    return enabled ? enableVisibilitySpoof() : disableVisibilitySpoof();
}

/**
 * React hook-friendly function that enables spoofing on mount and disables on unmount.
 * Usage:
 * ```tsx
 * useEffect(() => {
 *   return createVisibilitySpoofCleanup();
 * }, []);
 * ```
 *
 * @returns Cleanup function that disables spoofing
 */
export function createVisibilitySpoofCleanup(): () => void {
    enableVisibilitySpoof();
    return () => disableVisibilitySpoof();
}
