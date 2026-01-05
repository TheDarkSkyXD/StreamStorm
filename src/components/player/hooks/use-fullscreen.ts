
import { useState, useEffect, useCallback, RefObject } from 'react';

export function useFullscreen(containerRef: RefObject<HTMLElement | null>) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === containerRef.current);
        };

        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, [containerRef]);

    const toggleFullscreen = useCallback(async () => {
        const container = containerRef.current;
        if (!container) return;

        try {
            if (document.fullscreenElement === container) {
                await document.exitFullscreen();
            } else if (!document.fullscreenElement) {
                await container.requestFullscreen();
            } else {
                // Different element is fullscreen - exit it first
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error('Failed to toggle Fullscreen:', error);
        }
    }, [containerRef]);

    return { isFullscreen, toggleFullscreen };
}
