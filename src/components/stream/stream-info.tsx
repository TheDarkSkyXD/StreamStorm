
import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformAvatar } from '@/components/ui/platform-avatar';
import { FollowButton } from '@/components/ui/follow-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UnifiedChannel, UnifiedStream } from '@/backend/api/unified/platform-types';
import { formatViewerCount, formatUptime } from '@/lib/utils';
import { PopoutManager } from '@/lib/popout-manager';
import { ExternalLink, Users, Clock } from 'lucide-react';
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
                className="shrink-0 text-xl font-bold shadow-lg ring-2 ring-offset-2 ring-offset-[var(--color-background)]"
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
                <p className="text-white font-bold truncate pr-4">{stream?.title || channel.bio || "No title set"}</p>
                <p className="text-[var(--color-foreground-muted)] text-sm capitalize flex items-center gap-1.5 mt-1">
                    <span className={channel.platform === 'twitch' ? 'text-[#9146FF]' : 'text-[#53FC18]'}>
                        {stream?.categoryName || "Variety"}
                    </span>
                </p>
            </div>

            {/* Right side: Follow button and live stats */}
            <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="icon"
                        title="Popout Player"
                        onClick={() => PopoutManager.openStreamPopout(channel.platform, channel.username || channel.id)}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </Button>
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
