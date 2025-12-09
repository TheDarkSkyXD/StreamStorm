import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

interface VolumeControlProps {
    volume: number; // 0 to 100
    muted: boolean;
    onVolumeChange: (volume: number) => void;
    onMuteToggle: () => void;
    className?: string;
}

export function VolumeControl({ volume, muted, onVolumeChange, onMuteToggle, className }: VolumeControlProps) {
    const [isHovering, setIsHovering] = useState(false);
    const sliderRef = useRef<HTMLInputElement>(null);

    const getIcon = () => {
        if (muted || volume === 0) return <VolumeX className="w-5 h-5" />;
        if (volume < 50) return <Volume1 className="w-5 h-5" />;
        return <Volume2 className="w-5 h-5" />;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onVolumeChange(Number(e.target.value));
    };

    return (
        <div
            className={`flex items-center group/volume ${className || ''}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 select-none z-10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onMuteToggle();
                        }}
                    >
                        {getIcon()}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{muted || volume === 0 ? 'Unmute (m)' : 'Mute (m)'}</p>
                </TooltipContent>
            </Tooltip>

            <div className={`
        flex items-center overflow-hidden transition-all duration-200 ease-in-out
        ${isHovering ? 'w-24 opacity-100 ml-2' : 'w-0 opacity-0'}
      `}>
                <input
                    ref={sliderRef}
                    type="range"
                    min="0"
                    max="100"
                    value={muted ? 0 : volume}
                    onChange={handleChange}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
            </div>
        </div>
    );
}
