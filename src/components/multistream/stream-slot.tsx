
import React from 'react';
import { useStreamPlayback } from '@/hooks/useStreamPlayback';
import { useChannelByUsername } from '@/hooks/queries/useChannels';
import { KickLivePlayer } from '@/components/player/kick';
import { TwitchLivePlayer } from '@/components/player/twitch';
import { useMultiStreamStore } from '@/store/multistream-store';
import { Button } from '@/components/ui/button';
import { X, MessageSquare, Volume2, VolumeX, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Platform } from '@/shared/auth-types';

interface StreamSlotProps {
    streamId: string;
    platform: Platform;
    channelName: string;
    isMuted: boolean;
    onRemove: () => void;
    onFocus: () => void;
    isFocused: boolean;
    dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export function StreamSlot({
    streamId,
    platform,
    channelName,
    isMuted,
    onRemove,
    onFocus,
    isFocused,
    dragHandleProps
}: StreamSlotProps) {
    const { toggleMute, setChatStream, chatStreamId } = useMultiStreamStore();
    const { playback, isLoading, reload } = useStreamPlayback(platform, channelName);

    // Fetch channel data to get offline banner, avatar, and display name
    const { data: channelData } = useChannelByUsername(channelName, platform);

    const isChatActive = chatStreamId === streamId;

    return (
        <div
            className={cn(
                "relative w-full h-full bg-black group border-2 transition-colors",
                isFocused ? "border-[var(--color-primary)]" : "border-transparent hover:border-[var(--color-border)]"
            )}
            onClick={onFocus}
        >
            {/* Platform Badge */}
            <div className="absolute top-2 left-2 z-20 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs font-medium text-white pointer-events-none">
                <span className={cn(
                    "font-bold uppercase mr-1",
                    platform === 'twitch' ? "text-[#9146FF]" : "text-[#53FC18]"
                )}>
                    {platform}
                </span>
                {channelData?.displayName || channelName}
            </div>

            {/* Slot Controls (Top Right) */}
            <div className="absolute top-2 right-2 z-20 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {dragHandleProps && (
                    <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 cursor-move"
                        {...dragHandleProps}
                        title="Drag to Move"
                    >
                        <GripVertical className="h-4 w-4" />
                    </Button>
                )}

                <Button
                    size="icon"
                    variant="secondary"
                    className={cn("h-8 w-8", isChatActive && "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90")}
                    onClick={(e) => {
                        e.stopPropagation();
                        setChatStream(streamId);
                    }}
                    title="Show Chat"
                >
                    <MessageSquare className="h-4 w-4" />
                </Button>

                <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleMute(streamId);
                    }}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>

                <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    title="Remove Stream"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Video Player - Only render when we have a valid playback URL */}
            <div className="w-full h-full">
                {playback?.url ? (
                    // Stream is live - render the player
                    platform === 'kick' ? (
                        <KickLivePlayer
                            streamUrl={playback.url}
                            autoPlay={true}
                            muted={isMuted}
                            className="pointer-events-none"
                        />
                    ) : (
                        <TwitchLivePlayer
                            streamUrl={playback.url}
                            autoPlay={true}
                            muted={isMuted}
                            className="pointer-events-none"
                        />
                    )
                ) : (
                    // No playback URL - show loading or offline state
                    <div className="absolute inset-0 z-10 overflow-hidden">
                        {isLoading ? (
                            // Loading state with gradient background
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/60 to-black">
                                <div
                                    className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                                    style={{
                                        borderColor: platform === 'kick' ? '#53FC18' : '#9146FF',
                                        borderTopColor: 'transparent'
                                    }}
                                />
                                <span className="text-white/70 text-sm mt-3">Loading stream...</span>
                            </div>
                        ) : (
                            // Offline state with banner/avatar background
                            <>
                                {/* Background: Offline banner if available, otherwise blurred avatar or gradient */}
                                {channelData?.bannerUrl ? (
                                    <img
                                        src={channelData.bannerUrl}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                ) : channelData?.avatarUrl ? (
                                    <>
                                        {/* Blurred, scaled-up avatar as background */}
                                        <img
                                            src={channelData.avatarUrl}
                                            alt=""
                                            className="absolute inset-0 w-full h-full object-cover blur-3xl scale-150 opacity-40"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
                                    </>
                                ) : (
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            background: platform === 'twitch'
                                                ? 'linear-gradient(to bottom, rgba(145, 70, 255, 0.3), rgb(0, 0, 0))'
                                                : 'linear-gradient(to bottom, rgba(83, 252, 24, 0.2), rgb(0, 0, 0))'
                                        }}
                                    />
                                )}

                                {/* Content overlay */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    {/* Avatar (if available and no banner) */}
                                    {channelData?.avatarUrl && !channelData?.bannerUrl && (
                                        <div className="mb-4">
                                            <img
                                                src={channelData.avatarUrl}
                                                alt={channelData.displayName || channelName}
                                                className="w-16 h-16 rounded-full border-2 border-white/20 shadow-xl"
                                            />
                                        </div>
                                    )}
                                    <div className="text-center">
                                        <p className="text-white text-lg font-bold mb-1 drop-shadow-lg">
                                            {channelData?.displayName || channelName}
                                        </p>
                                        <p className="text-white/70 text-sm mb-4">is currently offline</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="bg-white/10 border-white/30 hover:bg-white/20 backdrop-blur-sm"
                                            onClick={(e) => { e.stopPropagation(); reload(); }}
                                        >
                                            Retry
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
