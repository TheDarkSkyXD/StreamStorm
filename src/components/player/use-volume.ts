import { useCallback, useEffect, useRef } from 'react';
import { useVolumeStore } from '@/store/volume-store';

interface UseVolumeOptions {
    videoRef: React.RefObject<HTMLVideoElement>;
    initialMuted?: boolean;
    watch?: any; // Dependency to trigger re-application (e.g. streamUrl)
}

/**
 * Hook for managing persistent volume across all players.
 * Syncs volume state with the global store and the video element.
 */
export function useVolume({ videoRef, initialMuted = false, watch }: UseVolumeOptions) {
    const { volume, isMuted, setVolume, setMuted, toggleMute } = useVolumeStore();
    const isFirstMount = useRef(true);

    // Apply stored volume and handle initial muted state
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.volume = volume / 100;

        // On first mount, use initialMuted prop; afterward use store state
        if (isFirstMount.current) {
            video.muted = initialMuted;
            setMuted(initialMuted); // Sync store with initial value
            isFirstMount.current = false;
        } else {
            video.muted = isMuted;
        }
    }, [videoRef, volume, isMuted, setMuted, watch]); // eslint-disable-line react-hooks/exhaustive-deps -- initialMuted intentionally excluded, only used on first mount

    // Handle volume change from UI
    const handleVolumeChange = useCallback((volumeOrFn: number | ((prev: number) => number)) => {
        const video = videoRef.current;
        if (!video) return;

        // Calculate new volume
        // We use video.volume * 100 as the source of truth for "previous" volume
        // to ensure we're stepping from the actual current level
        const currentVol = video.volume * 100;
        const newVolume = typeof volumeOrFn === 'function' ? volumeOrFn(currentVol) : volumeOrFn;

        const vol = Math.max(0, Math.min(100, newVolume));
        video.volume = vol / 100;
        setVolume(vol); // Store handles its own clamping/functional update but we pass the resolved value here

        if (vol > 0 && video.muted) {
            video.muted = false;
            setMuted(false);
        }
        if (vol === 0) {
            video.muted = true;
            setMuted(true);
        }
    }, [setVolume, setMuted]);

    // Handle mute toggle from UI
    const handleToggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !video.muted;
        setMuted(video.muted);
    }, [setMuted]);

    // Sync store when video element fires volumechange event
    const syncFromVideoElement = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        setMuted(video.muted);
        setVolume(video.volume * 100);
    }, [setVolume, setMuted]);

    return {
        volume,
        isMuted,
        handleVolumeChange,
        handleToggleMute,
        syncFromVideoElement,
    };
}
