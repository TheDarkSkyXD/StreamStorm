
import React from 'react';
import { useStreamPlayback } from '@/hooks/useStreamPlayback';
import { KickVideoPlayer } from '@/components/player/kick';
import { TwitchVideoPlayer } from '@/components/player/twitch';
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
                {channelName}
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

            {/* Video Player - Platform Specific */}
            <div className="w-full h-full">
                {platform === 'kick' ? (
                    <KickVideoPlayer
                        streamUrl={playback?.url || ''}
                        autoPlay={true}
                        muted={isMuted}
                        className="pointer-events-none"
                    />
                ) : (
                    <TwitchVideoPlayer
                        streamUrl={playback?.url || ''}
                        autoPlay={true}
                        muted={isMuted}
                        className="pointer-events-none"
                    />
                )}

                {/* Loading / Error States */}
                {isLoading && !playback && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
                        <span className="text-white text-sm">Loading...</span>
                    </div>
                )}

                {!isLoading && !playback && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <div className="text-center">
                            <p className="text-white mb-2 text-sm">Offline</p>
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); reload(); }}>
                                Retry
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
