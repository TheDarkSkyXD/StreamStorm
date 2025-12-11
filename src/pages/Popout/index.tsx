
import React from 'react';
import { useParams } from '@tanstack/react-router';
import { KickVideoPlayer } from '@/components/player/kick';
import { TwitchVideoPlayer } from '@/components/player/twitch';
import { useStreamPlayback } from '@/hooks/useStreamPlayback';
import { Platform } from '@/shared/auth-types';

export function PopoutPage() {
    const { platform, channel } = useParams({ from: '/popout/$platform/$channel' });

    const {
        playback,
        isLoading,
        error
    } = useStreamPlayback(platform as Platform, channel);

    if (error) {
        return (
            <div className="w-screen h-screen bg-black flex items-center justify-center text-white">
                <p>Error loading stream</p>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen bg-black overflow-hidden">
            {platform === 'kick' ? (
                <KickVideoPlayer
                    streamUrl={playback?.url || ''}
                    autoPlay={true}
                    muted={false}
                    className="w-full h-full"
                />
            ) : (
                <TwitchVideoPlayer
                    streamUrl={playback?.url || ''}
                    autoPlay={true}
                    muted={false}
                    className="w-full h-full"
                />
            )}
        </div>
    );
}

