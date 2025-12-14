import React, { useRef, useState, useCallback, useMemo } from 'react';
import { formatDuration } from '@/lib/utils';

interface KickProgressBarProps {
    currentTime: number;
    duration: number;
    onSeek?: (time: number) => void;
    buffered?: TimeRanges;
    seekableRange?: { start: number; end: number } | null;
    className?: string;
    isLive?: boolean;
}

export function KickProgressBar({
    currentTime,
    duration,
    onSeek,
    buffered,
    seekableRange,
    className = '',
    isLive = false
}: KickProgressBarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0); // 0 to 1

    const progress = useMemo(() => {
        // For live streams, show full progress (DVR not fully supported)
        if (isLive) return 100;
        // For VODs, show actual progress based on current time
        if (!duration || duration === 0) return 0;
        return Math.min(100, (currentTime / duration) * 100);
    }, [currentTime, duration, isLive]);

    // Calculate seekable bar styles
    const seekableStyle = useMemo(() => {
        if (!duration || !seekableRange) return { left: '0%', width: '0%' };

        const startPct = Math.max(0, (seekableRange.start / duration) * 100);
        const endPct = Math.min(100, (seekableRange.end / duration) * 100);

        return {
            left: `${startPct}%`,
            width: `${Math.max(0, endPct - startPct)}%`
        };
    }, [duration, seekableRange]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pos = (e.clientX - rect.left) / rect.width;
        setHoverPosition(Math.max(0, Math.min(1, pos)));
    }, []);

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || !duration || !onSeek) return;

        // For live streams, seeking is disabled (DVR not fully supported)
        if (isLive) return;

        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pos = (e.clientX - rect.left) / rect.width;
        let time = Math.max(0, Math.min(1, pos)) * duration;

        // Clamp to seekable range if available
        if (seekableRange) {
            if (time < seekableRange.start) time = seekableRange.start;
            if (time > seekableRange.end) time = seekableRange.end;
        }

        // Seek to the clicked position
        onSeek(time);
    }, [duration, onSeek, seekableRange, isLive]);

    // Kick brand green color
    const kickGreen = '#53fc18';

    return (
        <div
            className={`group relative w-full h-4 cursor-pointer flex items-center select-none touch-none ${className}`}
            ref={containerRef}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
        >
            {/* Background Track - Darker */}
            <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden">

                {/* Seekable Range - White/20 */}
                {seekableRange && (
                    <div
                        className="absolute top-0 bottom-0 h-full bg-white/20"
                        style={seekableStyle}
                    />
                )}

                {/* Current Progress - Kick Green */}
                <div
                    className="absolute top-0 bottom-0 left-0 h-full"
                    style={{ width: `${progress}%`, backgroundColor: kickGreen }}
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

            {/* Hover Tooltip/Time */}
            {isHovering && duration > 0 && (
                <div
                    className="absolute bottom-full mb-2 -translate-x-1/2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border pointer-events-none whitespace-nowrap z-50"
                    style={{
                        left: `${hoverPosition * 100}%`,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        borderColor: `${kickGreen}50`
                    }}
                >
                    {formatDuration(hoverPosition * duration)}
                </div>
            )}
        </div>
    );
}
