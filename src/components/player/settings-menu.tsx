import React, { useState, useMemo } from 'react';
import { Settings, PictureInPicture, Check, Activity } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { QualityLevel } from './types';

// Custom Settings Menu (replaces simple QualitySelector)
// Features: Quality, Theater Mode, Picture-in-Picture

export interface SettingsMenuProps {
    qualities: QualityLevel[];
    currentQualityId: string;
    onQualityChange: (qualityId: string) => void;
    onTogglePip?: () => void;
    onToggleTheater?: () => void;
    isTheater?: boolean;
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
    onOpenChange?: (isOpen: boolean) => void;
    showVideoStats?: boolean;
    onToggleVideoStats?: () => void;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function SettingsMenu({
    qualities,
    currentQualityId,
    onQualityChange,
    onTogglePip,
    onToggleTheater,
    isTheater,
    playbackRate = 1,
    onPlaybackRateChange,
    onOpenChange,
    showVideoStats = false,
    onToggleVideoStats
}: SettingsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeSubMenu, setActiveSubMenu] = useState<'main' | 'quality' | 'speed'>('main');

    // Notify parent of open state changes
    React.useEffect(() => {
        onOpenChange?.(isOpen);
    }, [isOpen, onOpenChange]);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
        setActiveSubMenu('main');
    };

    const sortedQualities = useMemo(() => {
        return [...qualities].sort((a, b) => {
            // Auto always at bottom
            if (a.isAuto) return 1;
            if (b.isAuto) return -1;

            // Sort by height descending
            if (a.height !== b.height) return b.height - a.height;

            // Then by bitrate descending
            return b.bitrate - a.bitrate;
        });
    }, [qualities]);

    const currentQualityLabel = qualities.find(q => q.id === currentQualityId)?.label || 'Auto';

    return (
        <div className="relative">
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleOpen();
                        }}
                    >
                        <Settings className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Settings</p>
                </TooltipContent>
            </Tooltip>

            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    <div className="absolute bottom-12 right-0 w-64 bg-[#1a1b1e]/95 backdrop-blur-md border border-[#2c2e33] rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">

                        {activeSubMenu === 'main' && (
                            <div className="py-2">
                                {/* Quality Menu Item */}
                                <button
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white"
                                    onClick={() => setActiveSubMenu('quality')}
                                >
                                    <span>Quality</span>
                                    <div className="flex items-center text-white">
                                        <span className="mr-2">
                                            {currentQualityLabel}
                                        </span>
                                        <span className="rotate-[-90deg]">›</span>
                                    </div>
                                </button>

                                {/* Speed Menu Item */}
                                {onPlaybackRateChange && (
                                    <button
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white"
                                        onClick={() => setActiveSubMenu('speed')}
                                    >
                                        <span>Speed</span>
                                        <div className="flex items-center text-white">
                                            <span className="mr-2">
                                                {playbackRate}x
                                            </span>
                                            <span className="rotate-[-90deg]">›</span>
                                        </div>
                                    </button>
                                )}

                                {/* PiP Toggle */}
                                {onTogglePip && (
                                    <button
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white"
                                        onClick={() => {
                                            onTogglePip();
                                            setIsOpen(false);
                                        }}
                                    >
                                        <span className="flex items-center gap-2">
                                            <PictureInPicture className="w-4 h-4" />
                                            Picture in Picture
                                        </span>
                                    </button>
                                )}

                                {onToggleVideoStats && (
                                    <div className="border-t border-white/10 mt-1 pt-1">
                                        <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white">
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4" />
                                                <span>Video Stats</span>
                                            </div>
                                            <Switch
                                                checked={showVideoStats}
                                                onCheckedChange={() => onToggleVideoStats()}
                                                className="data-[state=checked]:!bg-[#9146FF] data-[state=checked]:!border-[#9146FF] data-[state=checked]:!border-2 data-[state=unchecked]:!bg-transparent data-[state=unchecked]:!border-white data-[state=unchecked]:!border-2"
                                                thumbClassName="bg-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeSubMenu === 'quality' && (
                            <div className="py-2">
                                <button
                                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/10 transition-colors text-sm text-white border-b border-white/5"
                                    onClick={() => setActiveSubMenu('main')}
                                >
                                    <span className="rotate-90">›</span>
                                    <span className="font-semibold">Quality</span>
                                </button>
                                <div className="max-h-60 overflow-y-auto">
                                    {sortedQualities.map(quality => (
                                        <button
                                            key={quality.id}
                                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white"
                                            onClick={() => {
                                                onQualityChange(quality.id);
                                                setIsOpen(false);
                                            }}
                                        >
                                            <span>{quality.label}</span>
                                            {currentQualityId === quality.id && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeSubMenu === 'speed' && onPlaybackRateChange && (
                            <div className="py-2">
                                <button
                                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/10 transition-colors text-sm text-white border-b border-white/5"
                                    onClick={() => setActiveSubMenu('main')}
                                >
                                    <span className="rotate-90">›</span>
                                    <span className="font-semibold">Speed</span>
                                </button>
                                <div className="max-h-60 overflow-y-auto">
                                    {PLAYBACK_SPEEDS.map(speed => (
                                        <button
                                            key={speed}
                                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white"
                                            onClick={() => {
                                                onPlaybackRateChange(speed);
                                                setIsOpen(false);
                                            }}
                                        >
                                            <span>{speed}x</span>
                                            {playbackRate === speed && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
