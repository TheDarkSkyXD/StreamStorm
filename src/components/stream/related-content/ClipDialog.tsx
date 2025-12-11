import React from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
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
import { ClipPlayer } from './ClipPlayer';
import { VideoOrClip } from './types';
import { TwitchLoadingSpinner } from '@/components/ui/loading-spinner';
import { TwitchVodPlayer } from '@/components/player/twitch';
import { KickVodPlayer } from '@/components/player/kick';

interface ClipDialogProps {
    selectedClip: VideoOrClip | null;
    onClose: () => void;
    clipLoading: boolean;
    clipError: string | null;
    clipPlaybackUrl: string | null;
    platform: Platform;
    channelName: string;
    channelData: UnifiedChannel | null | undefined;
    onPlaybackError: () => void;
}

export function ClipDialog({
    selectedClip,
    onClose,
    clipLoading,
    clipError,
    clipPlaybackUrl,
    platform,
    channelName,
    channelData,
    onPlaybackError,
}: ClipDialogProps) {
    return (
        <Dialog open={!!selectedClip} onOpenChange={(open) => !open && onClose()}>
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
                                    <div className="text-center text-white">
                                        <div className="mb-3 flex justify-center">
                                            <TwitchLoadingSpinner />
                                        </div>
                                        <p>Loading clip...</p>
                                    </div>
                                ) : clipError ? (
                                    <div className="text-center text-red-500">
                                        <p className="mb-2">Failed to load clip</p>
                                        <p className="text-sm text-[var(--color-foreground-muted)]">{clipError}</p>
                                    </div>
                                ) : clipPlaybackUrl ? (
                                    // Platform-specific VOD player for clips
                                    platform === 'twitch' ? (
                                        <TwitchVodPlayer
                                            streamUrl={clipPlaybackUrl}
                                            autoPlay
                                            className="w-full h-full"
                                            videoId={selectedClip.id}
                                            title={selectedClip.title}
                                        />
                                    ) : (
                                        <KickVodPlayer
                                            streamUrl={clipPlaybackUrl}
                                            autoPlay
                                            className="w-full h-full"
                                            videoId={selectedClip.id}
                                            title={selectedClip.title}
                                        />
                                    )
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
    );
}
