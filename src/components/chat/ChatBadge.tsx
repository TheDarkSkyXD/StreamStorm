import React, { useState, useCallback, memo, useMemo } from 'react';
import { BadgeTooltip } from './tooltips/BadgeTooltip';

interface ChatBadgeProps {
    badge: {
        imageUrl?: string;
        title?: string;
        setId?: string;
        version?: string;
    };
    platform?: 'twitch' | 'kick';
}

/**
 * ChatBadge Component - Performance Optimized
 * 
 * Renders chat badges with tooltip support.
 * Memoized to prevent re-renders when props haven't changed.
 */
export const ChatBadge: React.FC<ChatBadgeProps> = memo(({ badge, platform = 'kick' }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

    const handleMouseEnter = useCallback((e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
        setShowTooltip(true);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    }, []);

    const handleMouseLeave = useCallback(() => {
        setShowTooltip(false);
    }, []);

    // Memoize badge info for tooltip
    const badgeInfo = useMemo(() => ({
        src: badge.imageUrl || '',
        title: badge.title || 'Badge',
        platform: platform === 'twitch' ? 'Twitch' as const : 'Kick' as const,
    }), [badge.imageUrl, badge.title, platform]);

    if (!badge.imageUrl) return null;

    return (
        <>
            <img
                src={badge.imageUrl}
                alt={badge.title || 'Badge'}
                loading="lazy"
                className="h-4 w-auto inline-block align-middle mr-1 cursor-pointer"
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />

            <BadgeTooltip
                show={showTooltip}
                mousePos={mousePos}
                badgeInfo={badgeInfo}
            />
        </>
    );
});

ChatBadge.displayName = 'ChatBadge';
