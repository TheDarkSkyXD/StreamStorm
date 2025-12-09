import React, { useState, useEffect, useRef } from 'react';
import { PlayPauseButton } from './play-pause-button';
import { VolumeControl } from './volume-control';
import { SettingsMenu } from './settings-menu';
import { QualityLevel } from './types';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '../ui/button';

interface PlayerControlsProps {
    // Playback state
    isPlaying: boolean;
    isLoading?: boolean;

    // Volume state
    volume: number;
    muted: boolean;

    // Quality state
    qualities: QualityLevel[];
    currentQualityId: string;

    // View states
    isFullscreen: boolean;
    isTheater?: boolean;

    // Handlers
    onTogglePlay: () => void;
    onVolumeChange: (volume: number) => void;
    onToggleMute: () => void;
    onQualityChange: (qualityId: string) => void;
    onToggleFullscreen: () => void;
    onToggleTheater?: () => void;
    onTogglePip?: () => void;
}

export function PlayerControls(props: PlayerControlsProps) {
    const {
        isPlaying,
        isLoading,
        volume,
        muted,
        qualities,
        currentQualityId,
        isFullscreen,
        isTheater,
        onTogglePlay,
        onVolumeChange,
        onToggleMute,
        onQualityChange,
        onToggleFullscreen,
        onToggleTheater,
        onTogglePip
    } = props;

    const [isVisible, setIsVisible] = useState(true);
    const hideTimeoutRef = useRef<NodeJS.Timeout>(null);

    // Auto-hide controls logic
    useEffect(() => {
        const showControls = () => {
            setIsVisible(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

            if (isPlaying) {
                hideTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false);
                }, 3000); // Hide after 3 seconds of inactivity
            }
        };

        // Initial trigger
        showControls();

        const handleMouseMove = () => showControls();

        // Attach listener to parent container if possible, creating context needed.
        // For now we assume this component is inside the container that captures events,
        // OR this component fills the container. 
        // Since this component is an overly, we'll let parent handle the mouse movement logic 
        // or assume parent renders this conditionally/passes visible prop?
        // 
        // Actually, Phase 3.2.5 says "Implement auto-hide controls". 
        // It's cleaner if the container handles mouse move. 
        // But let's add listeners to document or window if this is fullscreen?
        // Let's implement simpler: Parent `VideoPlayer` should probably handle visibility state 
        // and pass it down, OR `PlayerControls` wraps the interactive area.
        // Let's make `PlayerControls` self-managing for now by listening to window mousemove when mounted?
        // Better: listen to mousemove on the parent container.
        //
        // For now, let's keep it visible if paused, and use a prop `visible` from parent if we want strict control.
        // But since I'm implementing it here:
        // If not playing, always visible.
    }, [isPlaying]);

    return (
        <div
            className={`
            absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/90 to-transparent pt-20 pb-4 px-4
            transition-opacity duration-300 ease-in-out
            ${isVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}
        `}
            onMouseEnter={() => {
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                setIsVisible(true);
            }}
            onMouseLeave={() => {
                if (isPlaying) {
                    hideTimeoutRef.current = setTimeout(() => setIsVisible(false), 2000);
                }
            }}
        >
            <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto">
                <div className="flex items-center gap-2">
                    <PlayPauseButton
                        isPlaying={isPlaying}
                        isLoading={isLoading}
                        onToggle={onTogglePlay}
                    />

                    <VolumeControl
                        volume={volume}
                        muted={muted}
                        onVolumeChange={onVolumeChange}
                        onMuteToggle={onToggleMute}
                    />

                    {/* Live Badge */}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded text-xs font-bold uppercase tracking-wider text-white ml-2 select-none">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        Live
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <SettingsMenu
                        qualities={qualities}
                        currentQualityId={currentQualityId}
                        onQualityChange={onQualityChange}
                        onTogglePip={onTogglePip}
                        onToggleTheater={onToggleTheater}
                        isTheater={isTheater}
                    />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={onToggleFullscreen}
                    >
                        {isFullscreen ? (
                            <Minimize className="w-5 h-5" />
                        ) : (
                            <Maximize className="w-5 h-5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
