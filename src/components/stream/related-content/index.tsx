import React, { useState, useEffect } from 'react';
import { useSearch } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RelatedContentProps, VideoOrClip } from './types';
import { ContentTabs } from './ContentTabs';
import { VideoCard } from './VideoCard';
import { ClipCard } from './ClipCard';
import { ClipDialog } from './ClipDialog';

export function RelatedContent({ platform, channelName, channelData, onClipSelectionChange }: RelatedContentProps) {
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

    // Notify parent about clip selection state (for muting main player)
    useEffect(() => {
        onClipSelectionChange?.(!!selectedClip);
    }, [selectedClip, onClipSelectionChange]);

    // Fetch data - wait for channelData to be loaded to get the channelId
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
                    const result = await api.videos.getByChannel({
                        platform,
                        channelName,
                        channelId: channelData?.id,
                        limit: 12
                    });
                    if (result.success) {
                        setVideos(result.data || []);
                        setDebugInfo(result.debug || null);
                    } else {
                        console.error("Failed to fetch videos:", result.error);
                        setError(result.error || "Failed to fetch videos");
                    }
                } else if (targetTab === 'clips') {
                    const result = await api.clips.getByChannel({
                        platform,
                        channelName,
                        channelId: channelData?.id,
                        limit: 12
                    });
                    if (result.success) {
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

        // Only fetch when we have both channel name and channel data (with id)
        if (platform && channelName && channelData?.id) {
            fetchData();
        }
    }, [activeTab, platform, channelName, channelData?.id]);

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

            // DEBUG: Log selected clip data
            console.log('[RelatedContent] Selected clip:', JSON.stringify(selectedClip, null, 2));
            console.log('[RelatedContent] embedUrl:', selectedClip.embedUrl);
            console.log('[RelatedContent] url:', selectedClip.url);

            try {
                const api = (window as any).electronAPI;
                if (!api) {
                    throw new Error('Electron API not found');
                }

                const clipUrlToUse = selectedClip.embedUrl || selectedClip.url;
                console.log('[RelatedContent] Requesting playback for clipUrl:', clipUrlToUse);

                const result = await api.clips.getPlaybackUrl({
                    platform,
                    clipId: selectedClip.id,
                    clipUrl: clipUrlToUse,
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

    const handleClipPlaybackError = () => {
        if (platform === 'twitch') {
            setClipPlaybackUrl(null);
        } else {
            setClipError('Failed to play clip');
        }
    };

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            <ContentTabs activeTab={activeTab} />

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
                                    <VideoCard
                                        key={video.id}
                                        video={video}
                                        platform={platform}
                                        channelName={channelName}
                                        channelData={channelData}
                                    />
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
                                    <ClipCard
                                        key={clip.id}
                                        clip={clip}
                                        onClick={() => setSelectedClip(clip)}
                                        platform={platform}
                                        channelName={channelName}
                                        channelData={channelData}
                                    />
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

            <ClipDialog
                selectedClip={selectedClip}
                onClose={() => setSelectedClip(null)}
                clipLoading={clipLoading}
                clipError={clipError}
                clipPlaybackUrl={clipPlaybackUrl}
                platform={platform}
                channelName={channelName}
                channelData={channelData}
                onPlaybackError={handleClipPlaybackError}
            />
        </div>
    );
}

// Re-export types for external use
export type { VideoOrClip, RelatedContentProps } from './types';
