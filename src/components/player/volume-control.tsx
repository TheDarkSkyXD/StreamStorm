import React, { useState, useRef } from 'react';
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
    const [isDragging, setIsDragging] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);

    const getIcon = () => {
        if (muted || volume === 0) return <VolumeX className="w-5 h-5" />;
        if (volume < 50) return <Volume1 className="w-5 h-5" />;
        return <Volume2 className="w-5 h-5" />;
    };

    const displayVolume = muted ? 0 : volume;

    return (
        <div
            className={`flex items-center group/volume ${className || ''}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => !isDragging && setIsHovering(false)}
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
                ${(isHovering || isDragging) ? 'w-24 opacity-100 ml-2' : 'w-0 opacity-0'}
            `}>
                {/* Custom slider with visible thumb and drag support */}
                <div
                    ref={sliderRef}
                    className="relative w-full h-4 flex items-center cursor-pointer select-none"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsDragging(true);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                        onVolumeChange(percent);

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                            const movePercent = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
                            onVolumeChange(movePercent);
                        };

                        const handleMouseUp = () => {
                            setIsDragging(false);
                            setIsHovering(false);
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                    }}
                >
                    {/* Track background */}
                    <div className="absolute w-full h-1 bg-white/30 rounded-full" />
                    {/* Filled track */}
                    <div
                        className="absolute h-1 bg-white rounded-full"
                        style={{ width: `${displayVolume}%` }}
                    />
                    {/* Thumb (white circle) - positioned to stay within bounds */}
                    <div
                        className="absolute w-3 h-3 bg-white rounded-full shadow-md cursor-pointer"
                        style={{
                            left: `calc(${displayVolume / 100} * (100% - 12px))`,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
