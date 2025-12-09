import React, { useRef, useState, useCallback, useMemo } from 'react';
import { formatDuration } from '@/lib/utils';

interface ProgressBarProps {
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    buffered?: TimeRanges;
    className?: string;
    color?: string; // Optional accent color class
}

export function ProgressBar({
    currentTime,
    duration,
    onSeek,
    buffered,
    className = '',
    color = 'bg-white'
}: ProgressBarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0); // 0 to 1

    const progress = useMemo(() => {
        if (!duration || duration === 0) return 0;
        return Math.min(100, (currentTime / duration) * 100);
    }, [currentTime, duration]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pos = (e.clientX - rect.left) / rect.width;
        setHoverPosition(Math.max(0, Math.min(1, pos)));
    }, []);

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || !duration) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pos = (e.clientX - rect.left) / rect.width;
        onSeek(Math.max(0, Math.min(1, pos)) * duration);
    }, [duration, onSeek]);

    return (
        <div
            className={`group relative w-full h-4 cursor-pointer flex items-center select-none touch-none ${className}`}
            ref={containerRef}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
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
                            className="absolute top-0 bottom-0 bg-white/30 h-full"
                            style={{
                                left: `${startPct}%`,
                                width: `${widthPct}%`
                            }}
                        />
                    )
                })}

                {/* Current Progress */}
                <div
                    className={`absolute top-0 bottom-0 left-0 h-full ${color}`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Thumb (only visible on hover/group-hover) */}
            <div
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform duration-100 shadow-xl pointer-events-none`}
                style={{ left: `${progress}%`, marginLeft: `-${(progress / 100) * 12}px` }} // slight visual fix
            />

            {/* Hover Tooltip/Time */}
            {isHovering && duration > 0 && (
                <div
                    className="absolute bottom-full mb-2 -translate-x-1/2 bg-black/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 pointer-events-none whitespace-nowrap z-50"
                    style={{ left: `${hoverPosition * 100}%` }}
                >
                    {formatDuration(hoverPosition * duration)}
                </div>
            )}
        </div>
    );
}
