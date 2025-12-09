
import React, { useState, useEffect } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play, Clapperboard } from 'lucide-react';
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { PlatformAvatar } from '@/components/ui/platform-avatar';
import { FollowButton } from '@/components/ui/follow-button';
import { Platform } from '@/shared/auth-types';
import { UnifiedChannel } from '@/backend/api/unified/platform-types';

// Mock Data (Moved from StreamPage)
const MOCK_VIDEOS = Array.from({ length: 6 }).map((_, i) => ({
    id: `vod-${i}`,
    title: `Previous Stream broadcast ${i}`,
    duration: '4:20:30',
    views: '10K',
    date: '2 days ago'
}));

const MOCK_CLIPS = Array.from({ length: 6 }).map((_, i) => ({
    id: `clip-${i}`,
    title: `Insane moment from yesterday ${i}`,
    duration: '0:30',
    views: '15K',
    date: '1 day ago',
    embedUrl: 'https://player.kick.com/example',
    gameName: 'Fortnite',
    isLive: i % 2 === 0
}));

interface RelatedContentProps {
    platform: Platform;
    channelName: string;
    channelData: UnifiedChannel | null | undefined;
}

export function RelatedContent({ platform, channelName, channelData }: RelatedContentProps) {
    const { tab: activeTab } = useSearch({ from: '/_app/stream/$platform/$channel' });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClip, setSelectedClip] = useState<typeof MOCK_CLIPS[0] | null>(null);

    // Fallback Loading logic
    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, [activeTab, platform, channelName]);

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            <div className="flex items-center gap-4 border-b border-[var(--color-border)]">
                <Link
                    from="/stream/$platform/$channel"
                    search={{ tab: 'videos' }}
                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'videos'
                        ? 'text-[var(--color-foreground)]'
                        : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]'
                        }`}
                >
                    <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Videos</span>
                    {activeTab === 'videos' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                </Link>
                <Link
                    from="/stream/$platform/$channel"
                    search={{ tab: 'clips' }}
                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'clips'
                        ? 'text-[var(--color-foreground)]'
                        : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]'
                        }`}
                >
                    <span className="flex items-center gap-2"><Clapperboard className="w-4 h-4" /> Clips</span>
                    {activeTab === 'clips' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                </Link>
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold capitalize">{activeTab || 'videos'}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading ? (
                        [...Array(6)].map((_, i) => (
                            <div key={i} className="space-y-3">
                                <Skeleton className="aspect-video rounded-xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))
                    ) : (
                        (activeTab === 'videos' || !activeTab) ? (
                            MOCK_VIDEOS.map((video) => (
                                <Link
                                    key={video.id}
                                    to="/video/$platform/$videoId"
                                    params={{
                                        platform: platform || 'twitch',
                                        videoId: video.id
                                    }}
                                    className="block group"
                                >
                                    <Card className="overflow-hidden cursor-pointer hover:border-white transition-colors h-full">
                                        <div className="aspect-video bg-[var(--color-background-tertiary)] relative">
                                            <div className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-xs text-white">
                                                {video.duration}
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                    <Play className="w-5 h-5 text-white fill-white" />
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="pt-3">
                                            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                                                {video.title}
                                            </h3>
                                            <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{video.date} • {video.views} views</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))
                        ) : (
                            MOCK_CLIPS.map((clip) => (
                                <div
                                    key={clip.id}
                                    onClick={() => setSelectedClip(clip)}
                                    className="block group cursor-pointer"
                                >
                                    <Card className="overflow-hidden hover:border-white transition-colors h-full">
                                        <div className="aspect-video bg-[var(--color-background-tertiary)] relative">

                                            <div className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-xs text-white">
                                                {clip.duration}
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                    <Play className="w-5 h-5 text-white fill-white" />
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="pt-3">
                                            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                                                {clip.title}
                                            </h3>
                                            <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{clip.date} • {clip.views} views</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>

            <Dialog open={!!selectedClip} onOpenChange={(open) => !open && setSelectedClip(null)}>
                <DialogContent className="max-w-[90vw] w-full max-w-[1600px] bg-black border-[var(--color-border)] p-0 overflow-hidden">
                    {selectedClip && (
                        <div className="flex flex-col md:flex-row p-0 overflow-hidden h-[80vh] w-full">
                            {/* Left Side: Video Player */}
                            <div className="flex-1 bg-black flex flex-col justify-center relative">
                                <div className="aspect-video w-full flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-white font-bold text-lg mb-2">Playing Clip: {selectedClip.title}</p>
                                        <p className="text-[var(--color-foreground-muted)]">Source: {selectedClip.embedUrl}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Info & Actions */}
                            <div className="w-[350px] bg-[var(--color-background-secondary)] shrink-0 border-l border-[var(--color-border)] p-6 flex flex-col gap-6 overflow-y-auto">
                                <div className="mt-8">
                                    <h2 className="text-xl font-bold text-white line-clamp-2">{selectedClip.title}</h2>
                                    <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-secondary)] mt-1">
                                        <span>{selectedClip.gameName}</span>
                                        <span>•</span>
                                        <span>{selectedClip.views} views</span>
                                        <span>•</span>
                                        <span>{selectedClip.date}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-[var(--color-border)] w-full" />

                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        <PlatformAvatar
                                            src={channelData?.avatarUrl || ''}
                                            alt={channelData?.displayName || channelName || ''}
                                            platform={(platform as Platform) || 'twitch'}
                                            size="w-12 h-12"
                                            className="bg-neutral-800"
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg hover:underline decoration-2 underline-offset-4 decoration-[var(--color-primary)] cursor-pointer">
                                                {channelData?.displayName || channelName}
                                            </span>
                                            <span className="text-[var(--color-foreground-muted)] text-sm">
                                                Followers hidden
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full">
                                        {channelData ? (
                                            <FollowButton channel={channelData} className="flex-1" />
                                        ) : (
                                            <Button disabled className="flex-1 rounded-full">Follow</Button>
                                        )}

                                        <Button variant="secondary" className="px-4 rounded-full font-bold">
                                            Share
                                        </Button>
                                    </div>
                                </div>

                                <div className="h-px bg-[var(--color-border)] w-full" />

                                <div className="flex flex-col gap-3 mt-auto">
                                    {selectedClip.isLive && (
                                        <Button variant="secondary" className="w-full h-12 text-base font-bold">
                                            Watch Livestream
                                        </Button>
                                    )}
                                    <Link
                                        to="/video/$platform/$videoId"
                                        params={{ platform: platform || 'twitch', videoId: 'mock-vod-id' }}
                                        className="w-full"
                                    >
                                        <Button variant="outline" className="w-full h-12 text-base font-bold border-[var(--color-border)] hover:bg-[var(--color-background-tertiary)]">
                                            Watch Full Video
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
