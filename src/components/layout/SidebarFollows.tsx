import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart } from 'lucide-react';
import { cn, formatViewerCount } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useFollowStore } from '@/store/follow-store';
import { useFollowedChannels } from '@/hooks/queries/useChannels';
import { useFollowedStreams } from '@/hooks/queries/useStreams';
import { PlatformAvatar } from '@/components/ui/platform-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { UnifiedChannel, UnifiedStream } from '@/backend/api/unified/platform-types';
import { ScrollArea } from '../ui/scroll-area';
import { getChannelKey, getStreamKey, getChannelNameKey } from '@/lib/id-utils';

interface SidebarFollowsProps {
    collapsed: boolean;
}

export function SidebarFollows({ collapsed }: SidebarFollowsProps) {
    const { twitchConnected, kickConnected } = useAuthStore();
    const { localFollows } = useFollowStore();

    // Fetch data
    const { data: twitchFollows } = useFollowedChannels('twitch', { enabled: twitchConnected });
    const { data: kickFollows } = useFollowedChannels('kick', { enabled: kickConnected });
    const { data: liveStreams, isLoading } = useFollowedStreams();

    // Merge and sort channels
    const { liveChannels, offlineChannels } = useMemo(() => {
        const channelMap = new Map<string, UnifiedChannel>();

        // 1. Add Local Follows (using centralized key generation)
        localFollows.forEach((c) => channelMap.set(getChannelKey(c), c));

        // 2. Add Remote Follows (overwrite local if dupes to get fresh data)
        if (twitchFollows) twitchFollows.forEach((c) => channelMap.set(getChannelKey(c), c));
        if (kickFollows) kickFollows.forEach((c) => channelMap.set(getChannelKey(c), c));

        const allChannels = Array.from(channelMap.values());

        // Map live streams by platform-aware keys for flexible matching
        // Different API endpoints return different ID formats, so we match by both
        // Uses centralized key generation from id-utils
        const streamByIdMap = new Map<string, UnifiedStream>();
        const streamByNameMap = new Map<string, UnifiedStream>();
        if (liveStreams) {
            liveStreams.forEach((s) => {
                // Use centralized key generation for consistency
                streamByIdMap.set(getStreamKey(s), s);
                if (s.channelName) {
                    streamByNameMap.set(getChannelNameKey(s.platform, s.channelName), s);
                }
            });
        }

        const live: UnifiedStream[] = [];
        const offline: UnifiedChannel[] = [];
        const addedStreamIds = new Set<string>(); // Track added streams to prevent duplicates

        allChannels.forEach((c) => {
            // Try matching by platform-ID first, then by platform-username (slug)
            let stream = streamByIdMap.get(getChannelKey(c));
            if (!stream && c.username) {
                stream = streamByNameMap.get(getChannelNameKey(c.platform, c.username));
            }

            if (stream) {
                // Prevent duplicate streams (same stream matched by different channels)
                const streamKey = getStreamKey(stream);
                if (addedStreamIds.has(streamKey)) {
                    return; // Skip - already added this stream
                }
                addedStreamIds.add(streamKey);

                // Hydrate avatar if missing on stream but present on channel
                // Create a new object to avoid mutating React Query cache
                const streamToAdd = (!stream.channelAvatar && c.avatarUrl)
                    ? { ...stream, channelAvatar: c.avatarUrl }
                    : stream;
                live.push(streamToAdd);
            } else {
                offline.push(c);
            }
        });

        // Sort live by viewers
        live.sort((a, b) => b.viewerCount - a.viewerCount);

        // Sort offline alpha
        offline.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return { liveChannels: live, offlineChannels: offline };
    }, [localFollows, twitchFollows, kickFollows, liveStreams]);

    if (isLoading && !liveChannels.length && !offlineChannels.length) {
        return (
            <div className="flex flex-col gap-2 p-2">
                {!collapsed && <Skeleton className="h-4 w-20 mb-2" />}
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        {!collapsed && (
                            <div className="flex flex-col gap-1 overflow-hidden w-full">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-2 w-12" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    if (liveChannels.length === 0 && offlineChannels.length === 0) {
        if (collapsed) return null;

        return (
            <div className="p-4 text-center text-[var(--color-foreground-muted)] text-xs">
                <Heart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>Follow channels to see them here</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {!collapsed && (
                <div className="px-3 py-2 text-xs font-bold text-white uppercase tracking-wider flex justify-between items-center">
                    <span>Following</span>
                    <span className="bg-[var(--color-background-tertiary)] text-[var(--color-foreground)] px-1.5 py-0.5 rounded text-[10px]">
                        {liveChannels.length + offlineChannels.length}
                    </span>
                </div>
            )}

            {/* Since sidebar is a flex col, we want this list to scroll effectively */}
            <ScrollArea className="flex-1">
                <div className="px-2 pb-2 space-y-1">
                    {liveChannels.map((stream) => (
                        <Link
                            key={`${stream.platform}-${stream.channelId}`}
                            to="/stream/$platform/$channel"
                            params={{ platform: stream.platform, channel: stream.channelName }}
                            search={{ tab: 'videos' }}
                            className={cn(
                                "flex items-center gap-3 p-1.5 rounded-md hover:bg-[var(--color-background-tertiary)] transition-colors group relative",
                                collapsed ? "justify-center" : ""
                            )}
                            title={collapsed ? `${stream.channelDisplayName} (Live: ${formatViewerCount(stream.viewerCount)})` : undefined}
                        >
                            <div className="relative shrink-0">
                                <PlatformAvatar
                                    src={stream.channelAvatar}
                                    alt={stream.channelDisplayName}
                                    platform={stream.platform}
                                    size="w-8 h-8"
                                    showBadge={false}
                                    className={cn(
                                        "ring-2 ring-transparent transition-all",
                                        "grayscale-0", // Live is always colored
                                        collapsed && "group-hover:ring-[var(--color-primary)]"
                                    )}
                                />
                                {/* Live dot for collapsed view mostly, but good for expanded too */}
                                {collapsed && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                )}
                            </div>

                            {!collapsed && (
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex justify-between items-center gap-1">
                                        <span className="truncate font-bold text-sm text-white group-hover:text-[var(--color-primary)] transition-colors">
                                            {stream.channelDisplayName}
                                        </span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={cn("flex h-2 w-2 rounded-full shrink-0", stream.platform === 'kick' ? "bg-[#53FC18]" : "bg-red-500")} />
                                            <span className="text-xs font-bold text-white">{formatViewerCount(stream.viewerCount)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-xs text-[#b2b2b2] font-bold">
                                        <span className="truncate" title={stream.categoryName}>{stream.categoryName}</span>
                                    </div>
                                </div>
                            )}
                        </Link>
                    ))}

                    {offlineChannels.map((channel) => (
                        <Link
                            key={`${channel.platform}-${channel.id}`}
                            to="/stream/$platform/$channel"
                            params={{ platform: channel.platform, channel: channel.username }}
                            search={{ tab: 'videos' }}
                            className={cn(
                                "flex items-center gap-3 p-1.5 rounded-md hover:bg-[var(--color-background-tertiary)] transition-colors group opacity-70 hover:opacity-100",
                                collapsed ? "justify-center" : ""
                            )}
                            title={collapsed ? channel.displayName : undefined}
                        >
                            <PlatformAvatar
                                src={channel.avatarUrl}
                                alt={channel.displayName}
                                platform={channel.platform}
                                size="w-8 h-8"
                                showBadge={false}
                                className="grayscale group-hover:grayscale-0 transition-all"
                            />

                            {!collapsed && (
                                <div className="min-w-0 flex-1">
                                    <span className="truncate font-bold text-sm text-white group-hover:text-[var(--color-foreground)] transition-colors block">
                                        {channel.displayName}
                                    </span>
                                    <span className="text-xs text-[var(--color-foreground-muted)] truncate block">
                                        Offline
                                    </span>
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
