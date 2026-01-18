
import React, { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformAvatar } from '@/components/ui/platform-avatar';
import { FollowButton } from '@/components/ui/follow-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UnifiedChannel, UnifiedStream } from '@/backend/api/unified/platform-types';
import { formatViewerCount, formatUptime } from '@/lib/utils';

import { Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StreamInfoProps {
    channel: UnifiedChannel | null | undefined;
    stream: UnifiedStream | null | undefined;
    isLoading: boolean;
}

export function StreamInfo({ channel, stream, isLoading }: StreamInfoProps) {
    // Real-time uptime counter
    const [uptime, setUptime] = useState<string>('0:00:00');

    useEffect(() => {
        if (!stream?.startedAt || !stream?.isLive) {
            setUptime('0:00:00');
            return;
        }



        // Update uptime immediately
        setUptime(formatUptime(stream.startedAt));

        // Update every second for real-time display
        const interval = setInterval(() => {
            setUptime(formatUptime(stream.startedAt));
        }, 1000);

        return () => clearInterval(interval);
    }, [stream?.startedAt, stream?.isLive]);

    if (isLoading || !channel) {
        return (
            <div className="flex justify-between items-start gap-4 animate-pulse">
                <Skeleton className="w-16 h-16 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Skeleton className="w-32 h-10 rounded-full" />
                    <Skeleton className="w-40 h-5" />
                </div>
            </div>
        );
    }

    const platformColor = channel.platform === 'twitch' ? '#9146FF' : '#53FC18';

    return (
        <div className="flex justify-between items-start gap-4">
            <PlatformAvatar
                src={channel.avatarUrl}
                alt={channel.displayName}
                platform={channel.platform}
                size="w-16 h-16"
                className={`shrink-0 text-xl font-bold shadow-lg ring-offset-2 ring-offset-[var(--color-background)] ${channel.platform === 'twitch' ? 'ring-2 ring-[#9146FF]' : 'ring-[3px] ring-[#53FC18]'
                    }`}
                isLive={stream?.isLive}
                liveStatusType={channel.platform === 'kick' ? 'badge' : 'dot'}
                disablePlatformBorder={true}
            />
            <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
                    {channel.displayName}
                    {channel.isVerified && (
                        <span className={`text-xs px-2 py-0.5 h-auto rounded font-bold shrink-0 ${channel.platform === 'twitch'
                            ? 'bg-[#9146FF]/20 text-[#9146FF]'
                            : 'bg-[#53FC18]/20 text-[#53FC18]'
                            }`}>
                            Verified
                        </span>
                    )}
                </h1>
                {/* Use stream title if live, otherwise fall back to channel's last stream title */}
                <p className="text-white font-bold truncate pr-4">{stream?.title || channel.lastStreamTitle || channel.bio || "No title set"}</p>
                <p className="text-[var(--color-foreground-muted)] text-sm capitalize flex items-center gap-1.5 mt-1">
                    {/* Use stream category if live, otherwise fall back to channel's last known category */}
                    {(stream?.categoryId || channel.categoryId) ? (
                        <Link
                            to="/categories/$platform/$categoryId"
                            params={{
                                platform: channel.platform,
                                categoryId: (stream?.categoryId || channel.categoryId)!
                            }}
                            className={`${channel.platform === 'twitch' ? 'text-[#9146FF] hover:text-[#9146FF]/80' : 'text-[#53FC18] hover:text-[#53FC18]/80'} font-semibold hover:underline cursor-pointer transition-colors`}
                        >
                            {stream?.categoryName || channel.categoryName || "Variety"}
                        </Link>
                    ) : (
                        <span className={channel.platform === 'twitch' ? 'text-[#9146FF]' : 'text-[#53FC18]'}>
                            {stream?.categoryName || channel.categoryName || "Variety"}
                        </span>
                    )}
                </p>
                {/* Stream Tags - Language, Mature, and Custom Tags */}
                {stream?.isLive && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {/* Language Tag */}
                        {stream.language && (
                            <span className="text-xs px-3 py-1 rounded-full font-medium bg-[#35353b] text-[#efeff1] hover:bg-[#45454b] transition-colors cursor-default">
                                {new Intl.DisplayNames(['en'], { type: 'language' }).of(stream.language) || stream.language.toUpperCase()}
                            </span>
                        )}
                        {/* Mature Content Tag */}
                        {stream.isMature && (
                            <span className="text-xs px-3 py-1 rounded-full font-medium bg-[#35353b] text-[#efeff1] hover:bg-[#45454b] transition-colors cursor-default">
                                18+
                            </span>
                        )}
                        {/* Custom Tags from API - filter out language duplicates */}
                        {stream.tags && stream.tags.length > 0 && (() => {
                            // Get the display name of the stream's language to filter duplicates
                            const languageDisplayName = stream.language
                                ? new Intl.DisplayNames(['en'], { type: 'language' }).of(stream.language)?.toLowerCase()
                                : null;

                            return stream.tags
                                .filter(tag => {
                                    // Filter out tags that match the language display name (case insensitive)
                                    const tagLower = tag.toLowerCase();
                                    return tagLower !== languageDisplayName;
                                })
                                .map((tag, index) => (
                                    <span
                                        key={`${tag}-${index}`}
                                        className="text-xs px-3 py-1 rounded-full font-medium bg-[#35353b] text-[#efeff1] hover:bg-[#45454b] transition-colors cursor-default"
                                    >
                                        {tag}
                                    </span>
                                ));
                        })()}
                    </div>
                )}
            </div>

            {/* Right side: Follow button and live stats */}
            <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2">
                    <FollowButton channel={channel} size="default" />
                </div>

                {/* Live stats: Viewer count and Uptime */}
                {stream?.isLive && (
                    <div className="flex items-center gap-4 text-sm">
                        {/* Viewer count */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-default">
                                    <Users className="w-4 h-4 text-white" />
                                    <span className="font-semibold text-white">
                                        {formatViewerCount(stream.viewerCount)}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {stream.viewerCount.toLocaleString()} Viewers
                            </TooltipContent>
                        </Tooltip>

                        {/* Uptime */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-default">
                                    <Clock className="w-4 h-4 text-white" />
                                    <span className="font-semibold tabular-nums text-white">
                                        {uptime}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Stream Uptime
                            </TooltipContent>
                        </Tooltip>
                    </div>
                )}
            </div>
        </div>
    );
}
