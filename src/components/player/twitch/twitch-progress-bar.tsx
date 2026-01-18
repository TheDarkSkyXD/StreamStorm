import React, { useRef, useState, useCallback, useMemo } from 'react';
import { formatDuration } from '@/lib/utils';
import { SeekPreview } from '../seek-preview';

interface TwitchProgressBarProps {
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    onSeekHover?: (time: number | null) => void;
    previewImage?: string;
    buffered?: TimeRanges;
    className?: string;
    isLive?: boolean;
}

export function TwitchProgressBar({
    currentTime,
    duration,
    onSeek,
    onSeekHover,
    previewImage,
    buffered,
    className = '',
    isLive = false
}: TwitchProgressBarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0); // 0 to 1

    const progress = useMemo(() => {
        if (isLive) return 100;
        if (!duration || duration === 0) return 0;
        return Math.min(100, (currentTime / duration) * 100);
    }, [currentTime, duration, isLive]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pos = (e.clientX - rect.left) / rect.width;
        const boundedPos = Math.max(0, Math.min(1, pos));
        setHoverPosition(boundedPos);
        onSeekHover?.(boundedPos * duration);
    }, [duration, onSeekHover]);

    const handleMouseLeave = useCallback(() => {
        setIsHovering(false);
        onSeekHover?.(null);
    }, [onSeekHover]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || !duration) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pos = (e.clientX - rect.left) / rect.width;
        onSeek(Math.max(0, Math.min(1, pos)) * duration);
    }, [duration, onSeek]);

    // Twitch brand purple color
    const twitchPurple = '#9146ff';

    return (
        <div
            className={`group relative w-full h-4 cursor-pointer flex items-center select-none touch-none ${className}`}
            ref={containerRef}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
        >
            {/* Background Track */}
            <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden">
                {/* Buffered Regions */}
                {buffered && Array.from({ length: buffered.length }).map((_, i) => {
                    const start = buffered.start(i);
                    const end = buffered.end(i);
                    const widthPct = ((end - start) / duration) * 100;
                    const startPct = (start / duration) * 100;

                    if (!isFinite(widthPct) || !isFinite(startPct)) return null;

                    return (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 h-full"
                            style={{
                                left: `${startPct}%`,
                                width: `${widthPct}%`,
                                backgroundColor: `${twitchPurple}40` // 40 = 25% opacity in hex
                            }}
                        />
                    )
                })}

                {/* Current Progress - Twitch Purple */}
                <div
                    className="absolute top-0 bottom-0 left-0 h-full"
                    style={{ width: `${progress}%`, backgroundColor: twitchPurple }}
                />
            </div>

            {/* Thumb (only visible on hover/group-hover) - White */}
            <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform duration-100 shadow-xl pointer-events-none"
                style={{
                    left: `${progress}%`,
                    marginLeft: `-${(progress / 100) * 12}px`
                }}
            />

            {/* Seek Preview Component */}
            {isHovering && duration > 0 && (
                <SeekPreview
                    time={hoverPosition * duration}
                    position={hoverPosition}
                    previewImage={previewImage}
                    className="border-[#9146ff]/30"
                />
            )}
        </div>
    );
}
