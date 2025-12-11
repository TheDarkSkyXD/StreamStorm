import React from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

interface PlayPauseButtonProps {
    isPlaying: boolean;
    isLoading?: boolean;
    onToggle: () => void;
    className?: string;
}

export function PlayPauseButton({ isPlaying, isLoading, onToggle, className }: PlayPauseButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`text-white hover:bg-white/20 rounded-full select-none ${className || ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                >
                    {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                    ) : (
                        <Play className="w-5 h-5 fill-current" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{isPlaying ? 'Pause (Space)' : 'Play (Space)'}</p>
            </TooltipContent>
        </Tooltip>
    );
}

