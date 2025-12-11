
import React, { useState, useEffect } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play, Clapperboard } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { PlatformAvatar } from '@/components/ui/platform-avatar';
import { FollowButton } from '@/components/ui/follow-button';
import { Platform } from '@/shared/auth-types';
import { UnifiedChannel } from '@/backend/api/unified/platform-types';
import { IPC_CHANNELS } from '@/shared/ipc-channels';

interface VideoOrClip {
    id: string;
    title: string;
    duration: string;
    views: string;
    date: string;
    thumbnailUrl: string;
    embedUrl?: string; // For clips
    url?: string; // For clips
    source?: string; // HLS m3u8 URL for VODs (especially Kick)
    gameName?: string;
    isLive?: boolean;
    // Additional metadata for passing to video page
    channelSlug?: string;
    channelName?: string;
    channelAvatar?: string | null;
    category?: string;
}



interface RelatedContentProps {
    platform: Platform;
    channelName: string;
    channelData: UnifiedChannel | null | undefined;
}

export function RelatedContent({ platform, channelName, channelData }: RelatedContentProps) {
    const { tab: activeTab } = useSearch({ from: '/_app/stream/$platform/$channel' });
    const [isLoading, setIsLoading] = useState(true);
    const [videos, setVideos] = useState<VideoOrClip[]>([]);
    const [clips, setClips] = useState<VideoOrClip[]>([]);
    const [selectedClip, setSelectedClip] = useState<VideoOrClip | null>(null);
    const [clipPlaybackUrl, setClipPlaybackUrl] = useState<string | null>(null);
    const [clipLoading, setClipLoading] = useState(false);
    const [clipError, setClipError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string | null>(null);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const api = (window as any).electronAPI;
                if (!api) {
                    // This should not happen if preload ran correctly
                    console.error('[RelatedContent] window.electronAPI is missing');
                    return;
                }

                const targetTab = activeTab || 'videos';

                if (targetTab === 'videos') {
                    console.log(`[RelatedContent] Requesting videos for ${platform}/${channelName} (ID: ${channelData?.id})`);
                    const result = await api.videos.getByChannel({
                        platform,
                        channelName,
                        channelId: channelData?.id,
                        limit: 12
                    });
                    if (result.success) {
                        console.log(`[RelatedContent] Received ${result.data?.length ?? 0} videos`);
                        setVideos(result.data || []);
                        setDebugInfo(result.debug || null);
                    } else {
                        console.error("Failed to fetch videos:", result.error);
                        setError(result.error || "Failed to fetch videos");
                    }
                } else if (targetTab === 'clips') {
                    console.log(`[RelatedContent] Requesting clips for ${platform}/${channelName} (ID: ${channelData?.id})`);
                    const result = await api.clips.getByChannel({
                        platform,
                        channelName,
                        channelId: channelData?.id,
                        limit: 12
                    });
                    if (result.success) {
                        console.log(`[RelatedContent] Received ${result.data?.length ?? 0} clips`);
                        setClips(result.data || []);
                    } else {
                        console.error("Failed to fetch clips:", result.error);
                        setError(result.error || "Failed to fetch clips");
                    }
                }
            } catch (error) {
                console.error("Failed to fetch content:", error);
                setError("Failed to load content");
            } finally {
                setIsLoading(false);
            }
        };

        if (platform && channelName) {
            fetchData();
        }
    }, [activeTab, platform, channelName, channelData?.id]); // Re-run when channelData loads to provide channelId

    // Fetch clip playback URL when a clip is selected
    useEffect(() => {
        if (!selectedClip) {
            setClipPlaybackUrl(null);
            setClipError(null);
            return;
        }

        const fetchClipUrl = async () => {
            setClipLoading(true);
            setClipError(null);
            try {
                const api = (window as any).electronAPI;
                if (!api) {
                    throw new Error('Electron API not found');
                }

                const result = await api.clips.getPlaybackUrl({
                    platform,
                    clipId: selectedClip.id,
                    clipUrl: selectedClip.embedUrl || selectedClip.url,
                });

                if (result.success && result.data) {
                    setClipPlaybackUrl(result.data.url);
                } else {
                    console.error('[RelatedContent] Failed to get clip URL:', result.error);
                    // For Twitch, we'll fall back to iframe embed
                    if (platform === 'twitch') {
                        setClipPlaybackUrl(null); // Signal to use iframe
                    } else {
                        setClipError(result.error || 'Failed to load clip');
                    }
                }
            } catch (err) {
                console.error('[RelatedContent] Error fetching clip URL:', err);
                // For Twitch, we'll fall back to iframe embed
                if (platform === 'twitch') {
                    setClipPlaybackUrl(null);
                } else {
                    setClipError('Failed to load clip');
                }
            } finally {
                setClipLoading(false);
            }
        };

        fetchClipUrl();
    }, [selectedClip, platform]);

    // Helper to format time ago
    const formatTimeAgo = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " years ago";

            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " months ago";

            interval = seconds / 86400;
            if (interval > 1) {
                const days = Math.floor(interval);
                if (days === 1) return "Yesterday";
                return days + " days ago";
            }

            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " hours ago";

            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " mins ago";

            return Math.floor(seconds) + " seconds ago";
        } catch (e) {
            return dateString; // Fallback
        }
    };

    // Helper to format view counts
    const formatViews = (views: string | number) => {
        const num = typeof views === 'string' ? parseInt(views.replace(/,/g, ''), 10) : views;
        if (isNaN(num)) return views;

        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toString();
    };

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
                    ) : error ? (
                        <div className="col-span-full py-12 text-center text-red-400">
                            <p>{error}</p>
                            <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="mt-2">Retry</Button>
                        </div>
                    ) : (
                        (activeTab === 'videos' || !activeTab) ? (
                            videos.length > 0 ? (
                                videos.map((video) => (
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
                                ))
                            ) : (
                                <div className="col-span-full py-12 text-center text-[var(--color-foreground-muted)]">
                                    No videos found
                                    {debugInfo && <p className="text-xs mt-2 opacity-50 font-mono">{debugInfo}</p>}
                                </div>
                            )
                        ) : (
                            clips.length > 0 ? (
                                clips.map((clip) => (
                                    <div
                                        key={clip.id}
                                        onClick={() => setSelectedClip(clip)}
                                        className="block group cursor-pointer"
                                    >
                                        <Card className="overflow-hidden hover:border-white transition-colors h-full border border-transparent bg-[var(--color-background-secondary)]">
                                            <div className="aspect-video bg-[var(--color-background-tertiary)] relative">
                                                {clip.thumbnailUrl && (
                                                    <img src={clip.thumbnailUrl} alt={clip.title} className="absolute inset-0 w-full h-full object-cover" />
                                                )}

                                                {/* Duration: Top Left */}
                                                <div className="absolute top-2 left-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                                                    {clip.duration}
                                                </div>

                                                {/* Views: Bottom Left */}
                                                <div className="absolute bottom-2 left-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                                                    {formatViews(clip.views)} views
                                                </div>

                                                {/* Date: Bottom Right */}
                                                <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                                                    {formatTimeAgo(clip.date)}
                                                </div>

                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                        <Play className="w-5 h-5 text-white fill-white" />
                                                    </div>
                                                </div>
                                            </div>
                                            <CardContent className="pt-3">
                                                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors text-white">
                                                    {clip.title}
                                                </h3>
                                            </CardContent>
                                        </Card>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-12 text-center text-[var(--color-foreground-muted)]">
                                    No clips found
                                </div>
                            )
                        )
                    )}
                </div>
            </div>

            <Dialog open={!!selectedClip} onOpenChange={(open) => !open && setSelectedClip(null)}>
                <DialogContent className="max-w-[90vw] w-full max-w-[1600px] bg-black border-[var(--color-border)] p-0 overflow-hidden">
                    <VisuallyHidden>
                        <DialogTitle>{selectedClip?.title || 'Clip Viewer'}</DialogTitle>
                        <DialogDescription>Viewing clip: {selectedClip?.title || 'Selected clip'}</DialogDescription>
                    </VisuallyHidden>
                    {selectedClip && (
                        <div className="flex flex-col md:flex-row p-0 overflow-hidden h-[80vh] w-full">
                            {/* Left Side: Video Player */}
                            <div className="flex-1 bg-black flex flex-col justify-center relative">
                                <div className="aspect-video w-full flex items-center justify-center">
                                    {clipLoading ? (
                                        <div className="text-center text-white/50">
                                            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2" />
                                            <p>Loading clip...</p>
                                        </div>
                                    ) : clipError ? (
                                        <div className="text-center text-red-500">
                                            <p className="mb-2">Failed to load clip</p>
                                            <p className="text-sm text-[var(--color-foreground-muted)]">{clipError}</p>
                                        </div>
                                    ) : clipPlaybackUrl ? (
                                        // Use native video player for direct MP4 URL
                                        <video
                                            src={clipPlaybackUrl}
                                            controls
                                            autoPlay
                                            className="w-full h-full object-contain"
                                            onError={() => {
                                                if (platform === 'twitch') {
                                                    // Fall back to iframe for Twitch
                                                    setClipPlaybackUrl(null);
                                                } else {
                                                    setClipError('Failed to play clip');
                                                }
                                            }}
                                        />
                                    ) : platform === 'twitch' ? (
                                        // Twitch iframe fallback when direct MP4 fails
                                        <iframe
                                            src={`https://clips.twitch.tv/embed?clip=${selectedClip.id}&parent=localhost`}
                                            width="100%"
                                            height="100%"
                                            allowFullScreen
                                            className="w-full h-full"
                                        />
                                    ) : (
                                        <div className="text-center text-white/50">
                                            <p>No playback URL available</p>
                                        </div>
                                    )}
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
