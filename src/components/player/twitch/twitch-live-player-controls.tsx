import React, { useState, useEffect, useRef } from 'react';
import { PlayPauseButton } from '../play-pause-button';
import { VolumeControl } from '../volume-control';
import { SettingsMenu } from '../settings-menu';
import { QualityLevel } from '../types';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '../../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip';

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

interface TwitchLivePlayerControlsProps {
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

    // Playback Speed
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
}

export function TwitchLivePlayerControls(props: TwitchLivePlayerControlsProps) {
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

    } = props;

    const [isVisible, setIsVisible] = useState(true);
    const hideTimeoutRef = useRef<NodeJS.Timeout>(null);

    // Twitch purple color
    const twitchPurple = '#9146ff';

    // Auto-hide controls logic
    useEffect(() => {
        const showControls = () => {
            setIsVisible(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

            if (isPlaying) {
                hideTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false);
                }, 3000);
            }
        };

        showControls();
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
            {/* No progress bar for live streams */}

            <div className="flex items-center justify-between w-full">
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
        </div>
    );
}
