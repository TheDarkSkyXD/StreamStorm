import { useParams, useSearch, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, HeartCrack, AlertCircle } from 'lucide-react';
import { KickVideoPlayer } from '@/components/player/kick';
import { TwitchVideoPlayer } from '@/components/player/twitch';

interface VideoMetadata {
    id: string;
    title: string;
    channelId: string;
    channelName: string;
    channelDisplayName: string;
    channelAvatar: string | null;
    views: number;
    duration: string;
    createdAt: string;
    thumbnailUrl: string;
    description: string;
    type: string;
    platform: string;
    category?: string;
}

function formatViews(views: number | string): string {
    const num = typeof views === 'string' ? parseInt(views, 10) : views;
    if (isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
}

function formatRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

export function VideoPage() {
    const { platform, videoId } = useParams({ from: '/_app/video/$platform/$videoId' });
    const searchParams = useSearch({ from: '/_app/video/$platform/$videoId' });

    // Extract all metadata from search params
    const {
        src: directSourceUrl,
        title: passedTitle,
        channelName: passedChannelName,
        channelDisplayName: passedChannelDisplayName,
        channelAvatar: passedChannelAvatar,
        views: passedViews,
        date: passedDate,
        category: passedCategory,
        duration: passedDuration
    } = searchParams;

    const [isFollowing, setIsFollowing] = useState(false);
    const [isHoveringFollow, setIsHoveringFollow] = useState(false);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchVideoData = async () => {
            setError(null);
            setStreamUrl(null);
            setIsLoading(true);

            try {
                if (!window.electronAPI) {
                    throw new Error("Electron API not found");
                }

                // Case 1: If we have a direct source URL (from video list), use it directly
                // This is the preferred path for Kick VODs since the api/v1/video endpoint
                // requires UUID which we may not have
                if (directSourceUrl) {
                    setStreamUrl(directSourceUrl);

                    // If we have metadata from search params, use it directly
                    if (passedTitle && passedChannelName) {
                        setVideoMetadata({
                            id: videoId,
                            title: passedTitle,
                            channelId: '',
                            channelName: passedChannelName,
                            channelDisplayName: passedChannelDisplayName || passedChannelName,
                            channelAvatar: passedChannelAvatar || null,
                            views: passedViews ? parseInt(passedViews, 10) : 0,
                            duration: passedDuration || '0:00',
                            createdAt: passedDate || new Date().toISOString(),
                            thumbnailUrl: '',
                            description: '',
                            type: 'archive',
                            platform: platform,
                            category: passedCategory
                        });
                        setIsLoading(false);
                        return;
                    }

                    // Fallback: try to fetch metadata from API
                    try {
                        const metadataResult = await window.electronAPI.videos.getMetadata({
                            platform: platform as 'twitch' | 'kick',
                            videoId
                        });
                        if (metadataResult.success && metadataResult.data) {
                            setVideoMetadata(metadataResult.data);
                        }
                    } catch (metaErr) {
                        console.warn('Could not fetch metadata, continuing with video playback');
                    }

                    setIsLoading(false);
                    return;
                }

                // Case 2: No direct URL - fetch playback URL and metadata from API
                const [playbackResult, metadataResult] = await Promise.all([
                    window.electronAPI.videos.getPlaybackUrl({
                        platform: platform as 'twitch' | 'kick',
                        videoId
                    }),
                    window.electronAPI.videos.getMetadata({
                        platform: platform as 'twitch' | 'kick',
                        videoId
                    })
                ]);

                if (playbackResult.success && playbackResult.data) {
                    setStreamUrl(playbackResult.data.url);
                } else {
                    console.error("VOD Fetch Error:", playbackResult.error);
                    setError(playbackResult.error || 'Failed to resolve VOD URL');
                }

                if (metadataResult.success && metadataResult.data) {
                    setVideoMetadata(metadataResult.data);
                } else {
                    console.warn("Metadata Fetch Warning:", metadataResult.error);
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load video');
            } finally {
                setIsLoading(false);
            }
        };
        if (platform && videoId) fetchVideoData();
    }, [platform, videoId, directSourceUrl, passedTitle, passedChannelName, passedChannelDisplayName, passedChannelAvatar, passedViews, passedDate, passedCategory, passedDuration]);

    // Use fetched data or passed data or fallbacks
    const videoTitle = videoMetadata?.title || passedTitle || "Loading...";
    const channelName = videoMetadata?.channelName || passedChannelName || "channel";
    const channelDisplayName = videoMetadata?.channelDisplayName || passedChannelDisplayName || passedChannelName || "Channel";
    const channelAvatar = videoMetadata?.channelAvatar || passedChannelAvatar;
    const views = videoMetadata ? formatViews(videoMetadata.views) : (passedViews ? formatViews(passedViews) : "—");
    const date = videoMetadata ? formatRelativeDate(videoMetadata.createdAt) : (passedDate ? formatRelativeDate(passedDate) : "—");
    const category = videoMetadata?.category || passedCategory;

    const getFollowButtonStyles = () => {
        if (isFollowing) {
            return 'bg-neutral-800 hover:bg-neutral-700 border-transparent border';
        }
        if (platform === 'twitch') return 'bg-[#9146FF] hover:bg-[#9146FF]/90 text-white border-transparent';
        if (platform === 'kick') return 'bg-[#53FC18] hover:bg-[#53FC18]/90 text-black border-transparent';
        return 'bg-primary text-primary-foreground';
    };

    return (
        <div className="h-full flex overflow-hidden">
            {/* Video Player Area */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="aspect-video bg-black flex items-center justify-center shrink-0 text-white relative group">
                    {streamUrl ? (
                        platform === 'kick' ? (
                            <KickVideoPlayer
                                streamUrl={streamUrl}
                                autoPlay={true}
                                className="size-full"
                                videoId={videoId}
                                title={videoTitle}
                            />
                        ) : (
                            <TwitchVideoPlayer
                                streamUrl={streamUrl}
                                autoPlay={true}
                                className="size-full"
                                videoId={videoId}
                                title={videoTitle}
                            />
                        )
                    ) : error ? (
                        <div className="text-center text-red-500">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="text-center text-white/50">
                            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2" />
                            <p>Loading VOD...</p>
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start gap-4">
                        <Link
                            to="/stream/$platform/$channel"
                            params={{ platform: platform || 'twitch', channel: channelName }}
                            search={{ tab: 'videos' }}
                            className="shrink-0"
                        >
                            {channelAvatar ? (
                                <img
                                    src={channelAvatar}
                                    alt={channelDisplayName}
                                    className={`w-14 h-14 rounded-full shadow-lg ring-2 ring-offset-2 ring-offset-[var(--color-background)] ${platform === 'twitch' ? 'ring-[#9146FF] hover:ring-[#9146FF]/80' : 'ring-[#53FC18] hover:ring-[#53FC18]/80'} transition-all object-cover`}
                                />
                            ) : (
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg ${platform === 'twitch' ? 'bg-[#9146FF]' : 'bg-[#53FC18] text-black'} ring-2 ring-offset-2 ring-offset-[var(--color-background)] ${platform === 'twitch' ? 'ring-[#9146FF] hover:ring-[#9146FF]/80' : 'ring-[#53FC18] hover:ring-[#53FC18]/80'} transition-all`}>
                                    {channelDisplayName.slice(0, 1).toUpperCase()}
                                </div>
                            )}
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-white mb-1">{videoTitle}</h1>
                            <div className="flex items-center gap-3 text-[var(--color-foreground-secondary)] text-sm flex-wrap">
                                <Link
                                    to="/stream/$platform/$channel"
                                    params={{ platform: platform || 'twitch', channel: channelName }}
                                    search={{ tab: 'videos' }}
                                    className={`font-bold text-white hover:underline ${platform === 'twitch' ? 'decoration-[#9146FF]' : 'decoration-[#53FC18]'} decoration-2 underline-offset-4`}
                                >
                                    {channelDisplayName}
                                </Link>
                                {category && (
                                    <>
                                        <span>•</span>
                                        <span className="text-[var(--color-foreground-muted)]">{category}</span>
                                    </>
                                )}
                                <span>•</span>
                                <span>{views} views</span>
                                <span>•</span>
                                <span>{date}</span>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <Button
                                className={`rounded-full font-bold transition-all gap-2 ${isFollowing ? 'w-10 h-10 p-0' : 'min-w-[100px]'} ${getFollowButtonStyles()}`}
                                size="sm"
                                onClick={() => setIsFollowing(!isFollowing)}
                                onMouseEnter={() => setIsHoveringFollow(true)}
                                onMouseLeave={() => setIsHoveringFollow(false)}
                            >
                                {isFollowing ? (
                                    isHoveringFollow ? (
                                        <HeartCrack className="w-5 h-5 text-red-500" strokeWidth={3} />
                                    ) : (
                                        <Heart className="w-5 h-5 fill-current text-white" strokeWidth={3} />
                                    )
                                ) : (
                                    <>
                                        <Heart className={`w-4 h-4 ${isHoveringFollow ? 'fill-current' : ''}`} strokeWidth={3} /> Follow
                                    </>
                                )}
                            </Button>
                            <Link
                                to="/stream/$platform/$channel"
                                params={{ platform: platform || 'twitch', channel: channelName }}
                                search={{ tab: 'videos' }}
                            >
                                <Button
                                    className="rounded-full font-bold bg-neutral-800 hover:bg-neutral-700 text-white border-transparent gap-2"
                                    size="sm"
                                >
                                    Watch Live
                                </Button>
                            </Link>
                        </div>
                    </div>



                    {/* Related Videos */}
                    <div>
                        <h2 className="text-lg font-bold text-white mb-4">More from {channelDisplayName}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <Link
                                    key={i}
                                    to="/video/$platform/$videoId"
                                    params={{ platform: platform || 'twitch', videoId: `related-${i}` }}
                                    className="block group"
                                >
                                    <div className="rounded-xl overflow-hidden bg-[var(--color-background-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-all">
                                        <div className="aspect-video bg-[var(--color-background-tertiary)] relative">
                                            <div className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-xs text-white">
                                                3:45:00
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <h3 className="font-semibold text-sm text-white line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                                                Another broadcast from {channelDisplayName} #{i}
                                            </h3>
                                            <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                                                3 days ago • 12K views
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Replay Panel (Placeholder) */}
            <div className="w-80 border-l border-[var(--color-border)] bg-[var(--color-background-secondary)] flex flex-col shrink-0 hidden lg:flex">
                <div className="p-3 border-b border-[var(--color-border)]">
                    <h2 className="font-semibold text-[var(--color-foreground)]">Chat Replay</h2>
                </div>
                <div className="flex-1 p-3 flex items-center justify-center">
                    <p className="text-[var(--color-foreground-muted)] text-sm text-center">Chat replay not available for this video</p>
                </div>
            </div>
        </div>
    );
}
