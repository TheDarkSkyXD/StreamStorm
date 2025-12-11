import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Play } from 'lucide-react';
import { VideoOrClip } from './types';
import { formatTimeAgo, formatViews } from './utils';
import { Platform } from '@/shared/auth-types';
import { UnifiedChannel } from '@/backend/api/unified/platform-types';

interface VideoCardProps {
    video: VideoOrClip;
    platform: Platform;
    channelName: string;
    channelData: UnifiedChannel | null | undefined;
}

export function VideoCard({ video, platform, channelName, channelData }: VideoCardProps) {
    return (
        <Link
            key={video.id}
            to={video.isLive ? "/stream/$platform/$channel" : "/video/$platform/$videoId"}
            params={video.isLive ? {
                platform: platform || 'twitch',
                channel: channelName
            } : {
                platform: platform || 'twitch',
                videoId: video.id
            }}
            search={!video.isLive ? {
                src: video.source || undefined,
                title: video.title,
                channelName: video.channelName || video.channelSlug || channelName,
                channelDisplayName: video.channelName || channelData?.displayName || channelName,
                channelAvatar: video.channelAvatar || channelData?.avatarUrl || undefined,
                views: video.views,
                date: video.date,
                category: video.category || video.gameName || undefined,
                duration: video.duration
            } : undefined}
            className="block group"
            onClick={(e) => {
                if (video.isLive) {
                    // Use setTimeout to ensure scroll happens after any potential navigation/render updates
                    setTimeout(() => {
                        const scrollContainer = document.getElementById('main-content-scroll-area');
                        if (scrollContainer) {
                            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }, 50);
                }
            }}
        >
            <Card className="overflow-hidden cursor-pointer hover:border-white transition-colors h-full border border-transparent bg-[var(--color-background-secondary)]">
                <div className="aspect-video bg-[var(--color-background-tertiary)] relative">
                    {video.thumbnailUrl && (
                        <img src={video.thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover" />
                    )}

                    {/* Duration: Top Left */}
                    <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs font-medium ${video.isLive ? 'bg-red-600 text-white' : 'bg-black/80 text-white'}`}>
                        {video.isLive ? 'LIVE' : video.duration}
                    </div>

                    {/* Views: Bottom Left */}
                    <div className="absolute bottom-2 left-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                        {formatViews(video.views)} views
                    </div>

                    {/* Date: Bottom Right */}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                        {video.isLive ? 'Today' : formatTimeAgo(video.date)}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                    </div>
                </div>
                <CardContent className="pt-3">
                    <h3 className="font-medium text-sm line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors text-white">
                        {video.title}
                    </h3>
                </CardContent>
            </Card>
        </Link>
    );
}
