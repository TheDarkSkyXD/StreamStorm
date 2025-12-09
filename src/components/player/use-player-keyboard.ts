import { useEffect } from 'react';

interface UsePlayerKeyboardProps {
    onTogglePlay: () => void;
    onToggleMute: () => void;
    onVolumeUp: () => void;
    onVolumeDown: () => void;
    onToggleFullscreen: () => void;
    onToggleTheater?: () => void;
    disabled?: boolean;
}

export function usePlayerKeyboard({
    onTogglePlay,
    onToggleMute,
    onVolumeUp,
    onVolumeDown,
    onToggleFullscreen,
    onToggleTheater,
    disabled = false
}: UsePlayerKeyboardProps) {
    useEffect(() => {
        if (disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            switch (e.key.toLowerCase()) {
                case 'k':
                case ' ':
                    e.preventDefault();
                    onTogglePlay();
                    break;
                case 'm':
                    e.preventDefault();
                    onToggleMute();
                    break;
                case 'f':
                    e.preventDefault();
                    onToggleFullscreen();
                    break;
                case 't':
                case 'alt': // Alt+T often used, but 't' is standard on Twitch
                    if (e.key === 't' && onToggleTheater) {
                        e.preventDefault();
                        onToggleTheater();
                    }
                    break;
                case 'arrowup':
                    e.preventDefault();
                    onVolumeUp();
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    onVolumeDown();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onTogglePlay, onToggleMute, onVolumeUp, onVolumeDown, onToggleFullscreen, onToggleTheater]);
}
