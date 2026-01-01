import { useParams, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Heart, HeartCrack } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useHistoryStore } from '@/store/history-store';

// Mock data matching the StreamPage mocks
const MOCK_CLIPS = Array.from({ length: 6 }).map((_, i) => ({
    id: `clip-${i}`,
    title: `Insane moment from yesterday ${i}`,
    duration: '0:30',
    views: '15K',
    date: '1 day ago',
    embedUrl: 'https://player.kick.com/example',
    channelName: 'Ninja', // This would come from API in real app
    gameName: 'Fortnite',
    isLive: true // Mock live status
}));

export function ClipPage() {
    const { platform, clipId } = useParams({ from: '/_app/clip/$platform/$clipId' });
    const [isFollowing, setIsFollowing] = useState(false);
    const [isHoveringFollow, setIsHoveringFollow] = useState(false);

    // Simulate finding the clip
    const clip = MOCK_CLIPS.find(c => c.id === clipId) || {
        ...MOCK_CLIPS[0],
        id: clipId,
        title: 'Clip not found (Mock Fallback)'
    };

    const { addToHistory } = useHistoryStore();

    useEffect(() => {
        if (clip) {
            addToHistory({
                id: `${platform}-clip-${clip.id}`,
                originalId: clip.id,
                title: clip.title,
                thumbnail: '',
                platform: platform as 'twitch' | 'kick',
                type: 'clip',
                channelName: clip.channelName,
                channelDisplayName: clip.channelName
            });
        }
    }, [clip, platform, addToHistory]);

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
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-y-auto">

                {/* Helper Navigation Breadcrumb */}
                <div className="p-4 border-b border-[var(--color-border)]">
                    <Link to="/stream/$platform/$channel" params={{ platform: platform || 'twitch', channel: clip.channelName }} search={{ tab: 'videos' }} className="text-sm text-[var(--color-foreground-muted)] hover:text-white flex items-center gap-2">
                        ← Back to {clip.channelName}'s stream
                    </Link>
                </div>

                {/* Content Container */}
                <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 max-w-[1600px] mx-auto w-full">

                    {/* Left Side: Video Player */}
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="aspect-video bg-black flex items-center justify-center rounded-xl overflow-hidden shadow-2xl relative w-full">
                            <div className="text-center">
                                <p className="text-white font-bold text-lg mb-2">Playing Clip: {clip.title}</p>
                                <div className="px-3 py-1 bg-[var(--color-background-secondary)] rounded text-xs inline-block text-[var(--color-foreground-muted)]">
                                    ID: {clipId} • {platform}
                                </div>
                            </div>
                        </div>

                        {/* Clip Title & game info (kept under video or move to right? User said "avatar username... below it follow button...", implying the main channel identity is on the right. 
                           I'll keep specific clip metadata (title, views, date) under the video, and channel identity/actions on the right as requested.) 
                        */}
                        <div>
                            <h1 className="text-xl font-bold text-white">{clip.title}</h1>
                            <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-secondary)] mt-1">
                                <span>{clip.gameName}</span>
                                <span>•</span>
                                <span>{clip.views} views</span>
                                <span>•</span>
                                <span>{clip.date}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Channel Info & Actions */}
                    <div className="w-full md:w-[350px] shrink-0 flex flex-col gap-6">

                        {/* Channel Identity */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <Link
                                    to="/stream/$platform/$channel"
                                    params={{ platform: platform || 'twitch', channel: clip.channelName }}
                                    search={{ tab: 'videos' }}
                                    className="shrink-0"
                                >
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg ${platform === 'twitch' ? 'bg-[#9146FF]' : 'bg-[#53FC18] text-black'} ring-2 ring-offset-2 ring-offset-[var(--color-background)] ${platform === 'twitch' ? 'ring-[#9146FF]' : 'ring-[#53FC18]'}`}>
                                        {clip.channelName.slice(0, 1).toUpperCase()}
                                    </div>
                                </Link>
                                <div className="flex flex-col">
                                    <Link
                                        to="/stream/$platform/$channel"
                                        params={{ platform: platform || 'twitch', channel: clip.channelName }}
                                        search={{ tab: 'videos' }}
                                        className="font-bold text-xl hover:underline decoration-2 underline-offset-4 decoration-[var(--color-primary)]"
                                    >
                                        {clip.channelName}
                                    </Link>
                                    <span className="text-[var(--color-foreground-muted)] text-sm">1.2M Followers</span>
                                </div>
                            </div>

                            {/* Actions Row: Follow & Share */}
                            <div className="flex gap-2 w-full">
                                <Button
                                    className={`font-bold transition-all gap-2 rounded-full ${isFollowing ? 'w-10 h-10 p-0 flex-none' : 'flex-1'} ${getFollowButtonStyles()}`}
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
                                <Button variant="secondary" className="px-4 rounded-full font-bold">
                                    Share
                                </Button>
                            </div>
                        </div>

                        <div className="h-px bg-[var(--color-border)] w-full" />

                        {/* Watch Actions */}
                        <div className="flex flex-col gap-3">
                            {clip.isLive && (
                                <Link
                                    to="/stream/$platform/$channel"
                                    params={{ platform: platform || 'twitch', channel: clip.channelName }}
                                    search={{ tab: 'videos' }} // or no tab to go to stream
                                    className="w-full"
                                >
                                    <Button variant="secondary" className="w-full h-12 text-base font-bold">
                                        Watch Livestream
                                    </Button>
                                </Link>
                            )}
                            {/* Note: Watch Full Video button is only shown when clip has an available VOD */}
                            {/* This page uses mock data - in real usage, check clip.vodId like ClipDialog does */}
                        </div>

                    </div>
                </div>
            </div>

            {/* Chat Area (Right Side) - Similar to Stream/Video pages for consistency */}
            <div className="w-80 border-l border-[var(--color-border)] bg-[var(--color-background-secondary)] flex flex-col shrink-0 hidden lg:flex">
                <div className="p-3 border-b border-[var(--color-border)]">
                    <h2 className="font-semibold text-[var(--color-foreground)]">Chat Replay</h2>
                </div>
                <div className="flex-1 p-3 flex items-center justify-center">
                    <p className="text-[var(--color-foreground-muted)] text-sm text-center">Chat replay not available for this clip</p>
                </div>
            </div>
        </div>
    );
}
