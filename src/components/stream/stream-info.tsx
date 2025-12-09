
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformAvatar } from '@/components/ui/platform-avatar';
import { FollowButton } from '@/components/ui/follow-button';
import { UnifiedChannel, UnifiedStream } from '@/backend/api/unified/platform-types';
import { formatViewerCount } from '@/lib/utils';
import { Platform } from '@/shared/auth-types';
import { PopoutManager } from '@/lib/popout-manager';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StreamInfoProps {
    channel: UnifiedChannel | null | undefined;
    stream: UnifiedStream | null | undefined;
    isLoading: boolean;
}

export function StreamInfo({ channel, stream, isLoading }: StreamInfoProps) {
    if (isLoading || !channel) {
        return (
            <div className="flex justify-between items-start gap-4 animate-pulse">
                <Skeleton className="w-16 h-16 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="w-32 h-10 rounded-full" />
            </div>
        );
    }

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
                    {stream?.viewerCount !== undefined && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-[var(--color-foreground-muted)]" />
                            <span>{formatViewerCount(stream.viewerCount)} viewers</span>
                        </>
                    )}
                </p>
            </div>

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
        </div>
    );
}
