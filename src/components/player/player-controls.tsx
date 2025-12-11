import React, { useState, useEffect, useRef } from 'react';
import { PlayPauseButton } from './play-pause-button';
import { VolumeControl } from './volume-control';
import { SettingsMenu } from './settings-menu';
import { QualityLevel } from './types';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { ProgressBar } from './progress-bar';
import { formatDuration } from '@/lib/utils';

const TheaterOutlineIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <line x1="15" x2="15" y1="3" y2="21" />
    </svg>
);

const TheaterFilledIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4V3z" fill="currentColor" stroke="none" />
        <line x1="15" x2="15" y1="3" y2="21" />
    </svg>
);

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
    // VOD specific
    currentTime?: number;
    duration?: number;
    onSeek?: (time: number) => void;
    buffered?: TimeRanges;

    // Playback Speed
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
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
        onTogglePip,
        currentTime = 0,
        duration = 0,
        onSeek,
        buffered,
        playbackRate,
        onPlaybackRateChange
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
            {/* VOD Progress Bar */}
            {
                duration > 0 && onSeek && (
                    <div className="w-full px-4 mb-2">
                        <ProgressBar
                            currentTime={currentTime}
                            duration={duration}
                            onSeek={onSeek}
                            buffered={buffered}
                        />
                    </div>
                )
            }

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

                    {/* Live Badge or Timestamp */}
                    {(!duration || duration === Infinity) ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded text-xs font-bold uppercase tracking-wider text-white ml-2 select-none">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Live
                        </div>
                    ) : (
                        <div className="text-white text-2xl font-bold ml-2 select-none">
                            {formatDuration(currentTime)} / {formatDuration(duration)}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <SettingsMenu
                        qualities={qualities}
                        currentQualityId={currentQualityId}
                        onQualityChange={onQualityChange}
                        onTogglePip={onTogglePip}
                        onToggleTheater={onToggleTheater}
                        isTheater={isTheater}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={onPlaybackRateChange}
                    />

                    {onToggleTheater && !isFullscreen && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`text-white hover:bg-white/20`}
                                    onClick={onToggleTheater}
                                >
                                    {isTheater ? (
                                        <TheaterFilledIcon className="w-5 h-5" />
                                    ) : (
                                        <TheaterOutlineIcon className="w-5 h-5" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Theater Mode (t)</p>
                            </TooltipContent>
                        </Tooltip>
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isFullscreen ? 'Exit Fullscreen (f)' : 'Fullscreen (f)'}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div >
    );
}
