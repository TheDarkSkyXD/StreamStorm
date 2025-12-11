import React, { useState, useEffect, useRef } from 'react';
import { PlayPauseButton } from '../play-pause-button';
import { VolumeControl } from '../volume-control';
import { SettingsMenu } from '../settings-menu';
import { QualityLevel } from '../types';
import { Maximize, Minimize, Monitor, Radio } from 'lucide-react';
import { Button } from '../../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip';
import { KickProgressBar } from './kick-progress-bar';
import { formatDuration } from '@/lib/utils';

interface KickLivePlayerControlsProps {
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

    // DVR/Seek support for live streams
    currentTime?: number;
    duration?: number;
    onSeek?: (time: number) => void;
    buffered?: TimeRanges;
    onGoLive?: () => void;

    // Playback Speed
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
}

export function KickLivePlayerControls(props: KickLivePlayerControlsProps) {
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
        onGoLive,
        playbackRate,
        onPlaybackRateChange
    } = props;

    const [isVisible, setIsVisible] = useState(true);
    const hideTimeoutRef = useRef<NodeJS.Timeout>(null);

    // Kick brand green color
    const kickGreen = '#53fc18';

    // Check if we're at the live edge (within 10 seconds of duration)
    const isAtLiveEdge = duration > 0 ? (duration - currentTime) < 10 : true;
    const isBehindLive = duration > 0 && !isAtLiveEdge;

    // Handle go live click
    const handleGoLive = () => {
        if (onGoLive) {
            onGoLive();
        } else if (onSeek && duration > 0) {
            // Seek to live edge
            onSeek(duration);
        }
    };

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
            {/* DVR Progress Bar - Kick Green (only show when DVR is available) */}
            {duration > 0 && onSeek && (
                <div className="w-full mb-2">
                    <KickProgressBar
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={onSeek}
                        buffered={buffered}
                    />
                </div>
            )}

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

                    {/* Show LIVE badge when at live edge */}
                    {isAtLiveEdge && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/60 ml-2 select-none">
                            <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: kickGreen }}
                            />
                            <span className="text-white text-sm font-bold uppercase tracking-wider">
                                LIVE
                            </span>
                        </div>
                    )}

                    {/* Show timestamp and Go Back Live button when behind live */}
                    {isBehindLive && (
                        <>
                            {/* How far behind we are */}
                            <div className="text-white text-2xl font-bold ml-2 select-none">
                                -{formatDuration(duration - currentTime)}
                            </div>

                            {/* Go Back Live Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-2 text-black font-bold text-xs uppercase tracking-wider px-3 py-1 rounded hover:opacity-90"
                                style={{ backgroundColor: kickGreen }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleGoLive();
                                }}
                            >
                                <Radio className="w-4 h-4 mr-1" />
                                Go Live
                            </Button>
                        </>
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

                    {onToggleTheater && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`text-white hover:bg-white/20 ${isTheater ? 'text-primary' : ''}`}
                                    onClick={onToggleTheater}
                                    style={isTheater ? { color: kickGreen } : undefined}
                                >
                                    <Monitor className="w-5 h-5" />
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
