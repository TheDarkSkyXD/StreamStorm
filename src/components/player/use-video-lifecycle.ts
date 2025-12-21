/**
 * useVideoLifecycle Hook
 *
 * Manages video element lifecycle for optimal performance and memory usage.
 * Handles proper initialization, teardown, and resource cleanup.
 *
 * Features:
 * - Proper video element cleanup on unmount (prevents memory leaks)
 * - Preloading strategy management
 * - Lazy initialization for off-screen videos
 * - HLS instance lifecycle management
 * - Memory pressure detection and response
 * - Source cleanup to release network resources
 *
 * @module player/use-video-lifecycle
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import type Hls from 'hls.js';

export interface VideoLifecycleOptions {
    /** Reference to the video element */
    videoRef: React.RefObject<HTMLVideoElement | null>;
    /** Reference to HLS instance */
    hlsRef: React.RefObject<Hls | null>;
    /** Stream URL */
    src: string;
    /** Whether the video should be active (default: true) */
    isActive?: boolean;
    /** Preload strategy: 'auto' | 'metadata' | 'none' (default: 'metadata') */
    preloadStrategy?: 'auto' | 'metadata' | 'none';
    /** Callback when video is cleaned up */
    onCleanup?: () => void;
    /** Whether to use lazy loading (default: false) */
    lazyLoad?: boolean;
    /** Intersection observer threshold for lazy loading (default: 0.1) */
    lazyThreshold?: number;
}

export interface VideoLifecycleState {
    /** Whether the video is currently loaded */
    isLoaded: boolean;
    /** Whether the video is in view (for lazy loading) */
    isInView: boolean;
    /** Whether the video has been cleaned up */
    isCleaned: boolean;
    /** Manually trigger cleanup of the video element */
    cleanup: () => void;
}

/** Internal state tracked by ref (without cleanup function) */
interface InternalLifecycleState {
    isLoaded: boolean;
    isInView: boolean;
    isCleaned: boolean;
}

/**
 * Properly clean up a video element to release resources
 */
export function cleanupVideoElement(
    video: HTMLVideoElement | null,
    hls: Hls | null
): void {
    if (!video) return;

    console.debug('[VideoLifecycle] Cleaning up video element');

    // 1. Pause playback
    if (!video.paused) {
        video.pause();
    }

    // 2. Destroy HLS instance first
    if (hls) {
        try {
            hls.destroy();
        } catch (e) {
            console.debug('[VideoLifecycle] HLS destroy error (may be already destroyed):', e);
        }
    }

    // 3. Clear the source
    video.removeAttribute('src');

    // 4. Remove all source children
    while (video.firstChild) {
        video.removeChild(video.firstChild);
    }

    // 5. Load empty source to release network resources
    // This is crucial for releasing the network connection
    video.load();

    // 6. Remove event listeners by cloning (optional, handled by React cleanup usually)
    // This is a nuclear option if needed for stubborn memory leaks
    // const clone = video.cloneNode(true);
    // video.parentNode?.replaceChild(clone, video);
}

/**
 * Hook to manage video element lifecycle
 */
export function useVideoLifecycle({
    videoRef,
    hlsRef,
    src,
    isActive = true,
    preloadStrategy = 'metadata',
    onCleanup,
    lazyLoad = false,
    lazyThreshold = 0.1,
}: VideoLifecycleOptions): VideoLifecycleState {
    const stateRef = useRef<InternalLifecycleState>({
        isLoaded: false,
        isInView: !lazyLoad, // If not lazy loading, consider always in view
        isCleaned: false,
    });

    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLElement | null>(null);

    // Set preload attribute
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.preload = preloadStrategy;
    }, [videoRef, preloadStrategy]);

    // Handle lazy loading with Intersection Observer
    useEffect(() => {
        if (!lazyLoad) {
            stateRef.current.isInView = true;
            return;
        }

        const video = videoRef.current;
        if (!video) return;

        // Get the container element (parent of video)
        containerRef.current = video.parentElement;
        if (!containerRef.current) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const isInView = entry.isIntersecting;
                    stateRef.current.isInView = isInView;

                    if (isInView && !stateRef.current.isLoaded && src) {
                        console.debug('[VideoLifecycle] Video entered view, loading');
                        stateRef.current.isLoaded = true;
                        // The actual loading is handled by HlsPlayer component
                    }
                });
            },
            { threshold: lazyThreshold }
        );

        observerRef.current.observe(containerRef.current);

        return () => {
            if (observerRef.current && containerRef.current) {
                observerRef.current.unobserve(containerRef.current);
                observerRef.current.disconnect();
            }
        };
    }, [lazyLoad, lazyThreshold, src, videoRef]);

    // Handle active/inactive state
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (!isActive) {
            // Pause and optionally reduce resource usage
            if (!video.paused) {
                video.pause();
            }
        }
    }, [isActive, videoRef]);

    // Memory pressure detection (experimental)
    useEffect(() => {
        // Check if the Memory API is available (Chrome only)
        // @ts-ignore - memory property exists in Chrome
        if (!performance.memory) return;

        const checkMemoryPressure = () => {
            // @ts-ignore
            const memInfo = performance.memory;
            const usedRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;

            if (usedRatio > 0.9) {
                console.warn('[VideoLifecycle] High memory pressure detected:',
                    `${(usedRatio * 100).toFixed(1)}% heap used`);

                // Could trigger quality reduction or pause non-focused streams
                // This is informational - actual response depends on implementation
            }
        };

        // Check periodically (every 30 seconds)
        const interval = setInterval(checkMemoryPressure, 30000);

        return () => clearInterval(interval);
    }, []);

    // Cleanup on source change
    useEffect(() => {
        // Reset cleaned state for new source so cleanup can run again
        stateRef.current.isCleaned = false;

        return () => {
            // Mark as cleaned to prevent double cleanup
            if (stateRef.current.isCleaned) return;
            stateRef.current.isCleaned = true;

            // Reset loaded state for new source
            stateRef.current.isLoaded = false;
        };
    }, [src]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.debug('[VideoLifecycle] Component unmounting, cleaning up');

            cleanupVideoElement(videoRef.current, hlsRef.current);
            stateRef.current.isCleaned = true;

            onCleanup?.();
        };
    }, [videoRef, hlsRef, onCleanup]);

    // Public cleanup function
    const cleanup = useCallback(() => {
        cleanupVideoElement(videoRef.current, hlsRef.current);
        stateRef.current.isCleaned = true;
        onCleanup?.();
    }, [videoRef, hlsRef, onCleanup]);

    return {
        ...stateRef.current,
        cleanup,
    };
}

/**
 * Hook to manage multiple video elements (for multistream scenarios)
 */
export function useMultiVideoLifecycle({
    maxConcurrentVideos = 6,
    onVideoLimitReached,
}: {
    maxConcurrentVideos?: number;
    onVideoLimitReached?: () => void;
}): {
    activeVideoCount: number;
    registerVideo: (id: string) => boolean;
    unregisterVideo: (id: string) => void;
    isAtLimit: boolean;
} {
    const activeVideosRef = useRef<Set<string>>(new Set());
    // Use state to trigger re-renders when count changes
    const [activeVideoCount, setActiveVideoCount] = useState(0);

    const registerVideo = useCallback((id: string): boolean => {
        if (activeVideosRef.current.size >= maxConcurrentVideos) {
            console.warn(`[MultiVideoLifecycle] Video limit reached (${maxConcurrentVideos})`);
            onVideoLimitReached?.();
            return false;
        }

        activeVideosRef.current.add(id);
        setActiveVideoCount(activeVideosRef.current.size);
        console.debug(`[MultiVideoLifecycle] Registered video: ${id}, total: ${activeVideosRef.current.size}`);
        return true;
    }, [maxConcurrentVideos, onVideoLimitReached]);

    const unregisterVideo = useCallback((id: string) => {
        activeVideosRef.current.delete(id);
        setActiveVideoCount(activeVideosRef.current.size);
        console.debug(`[MultiVideoLifecycle] Unregistered video: ${id}, total: ${activeVideosRef.current.size}`);
    }, []);

    return {
        activeVideoCount,
        registerVideo,
        unregisterVideo,
        isAtLimit: activeVideoCount >= maxConcurrentVideos,
    };
}

/**
 * Utility hook to detect when component is being rapidly created/destroyed
 * (useful for detecting navigation-related video churn)
 */
export function useVideoChurnDetection(): {
    isChurning: boolean;
    mountCount: number;
} {
    const mountCountRef = useRef(0);
    const lastMountTimeRef = useRef(Date.now());
    const isChurningRef = useRef(false);

    useEffect(() => {
        const now = Date.now();
        const timeSinceLastMount = now - lastMountTimeRef.current;

        // If mounted again within 1 second, increment churn counter
        if (timeSinceLastMount < 1000) {
            mountCountRef.current++;
            if (mountCountRef.current >= 3) {
                isChurningRef.current = true;
                console.warn('[VideoLifecycle] Video churn detected - component is being rapidly recreated');
            }
        } else {
            // Reset counters if enough time has passed
            mountCountRef.current = 1;
            isChurningRef.current = false;
        }

        lastMountTimeRef.current = now;

        return () => {
            // This will be called on unmount, tracked on next mount
        };
    }, []);

    return {
        isChurning: isChurningRef.current,
        mountCount: mountCountRef.current,
    };
}
