import { useParams, Link, useSearch } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Clapperboard, Heart, HeartCrack } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  embedUrl: 'https://player.kick.com/example', // Mock
  gameName: 'Fortnite',
  isLive: i % 2 === 0 // Mock some as live
}));

export function StreamPage() {
  const { platform, channel } = useParams({ from: '/stream/$platform/$channel' });
  const { tab: activeTab } = useSearch({ from: '/stream/$platform/$channel' });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isHoveringFollow, setIsHoveringFollow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<typeof MOCK_CLIPS[0] | null>(null);

  useEffect(() => {
    // Simulate data fetching
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeTab, platform, channel]);

  const getFollowButtonStyles = () => {
    if (isFollowing) {
      return 'bg-neutral-800 hover:bg-neutral-700 border-transparent border';
    }
    if (platform === 'twitch') return 'bg-[#9146FF] hover:bg-[#9146FF]/90 text-white border-transparent';
    if (platform === 'kick') return 'bg-[#53FC18] hover:bg-[#53FC18]/90 text-black border-transparent';
    return 'bg-primary text-primary-foreground';
  };

  return (
    <div className="h-full flex">
      {/* Video Player Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="aspect-video bg-black flex items-center justify-center shrink-0">
          <span className="text-white/50">Video Player ({platform})</span>
        </div>

        <div className="p-6 space-y-6">

          <div className="flex justify-between items-start gap-4">
            <div className={`w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-xl font-bold text-white shadow-lg ${platform === 'twitch' ? 'bg-[#9146FF]' : 'bg-[#53FC18] text-black'
              } ring-2 ring-offset-2 ring-offset-[var(--color-background)] ${platform === 'twitch' ? 'ring-[#9146FF]' : 'ring-[#53FC18]'
              }`}>
              {channel?.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {channel}
                {platform === 'twitch' && <span className="badge-twitch text-xs px-2 py-0.5 h-auto">Twitch Partner</span>}
                {platform === 'kick' && <span className="badge-kick text-xs px-2 py-0.5 h-auto">Kick Verified</span>}
              </h1>
              <p className="text-white font-bold">Stream Title Goes Here</p>
              <p className="text-[var(--color-foreground-muted)] text-sm capitalize flex items-center gap-1.5 mt-1">
                <span className={platform === 'twitch' ? 'text-[#9146FF]' : platform === 'kick' ? 'text-[#53FC18]' : ''}>Just Chatting</span>
                <span className="w-1 h-1 rounded-full bg-[var(--color-foreground-muted)]" />
                <span>12.5K viewers</span>
              </p>
            </div>
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
          </div>

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
            <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>

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
                activeTab === 'videos' ? (
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
        </div>
      </div>

      {/* Chat Panel */}
      <div className="w-80 border-l border-[var(--color-border)] bg-[var(--color-background-secondary)] flex flex-col shrink-0">
        <div className="p-3 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Chat</h2>
        </div>
        <div className="flex-1 p-3">
          <p className="text-[var(--color-foreground-muted)] text-sm">Chat messages will appear here</p>
        </div>
        <div className="p-3 border-t border-[var(--color-border)]">
          <input
            type="text"
            placeholder="Send a message..."
            className="w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)] text-sm focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
      </div>

      <Dialog open={!!selectedClip} onOpenChange={(open) => !open && setSelectedClip(null)}>
        <DialogContent className="max-w-[90vw] w-full max-w-[1600px] bg-black border-[var(--color-border)] p-0 overflow-hidden">
          {selectedClip && (
            <>
              <div className="flex flex-col md:flex-row p-0 overflow-hidden h-[80vh] w-full">

                {/* Left Side: Video Player */}
                <div className="flex-1 bg-black flex flex-col justify-center relative">
                  <div className="aspect-video w-full flex items-center justify-center">
                    {/* Placeholder for clip player */}
                    <div className="text-center">
                      <p className="text-white font-bold text-lg mb-2">Playing Clip: {selectedClip.title}</p>
                      <p className="text-[var(--color-foreground-muted)]">Source: {selectedClip.embedUrl}</p>
                    </div>
                  </div>
                </div>

                {/* Right Side: Info & Actions */}
                <div className="w-[350px] bg-[var(--color-background-secondary)] shrink-0 border-l border-[var(--color-border)] p-6 flex flex-col gap-6 overflow-y-auto">
                  {/* Clip Info */}
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

                  {/* Channel Identity */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg ${platform === 'twitch' ? 'bg-[#9146FF]' : 'bg-[#53FC18] text-black'} ring-2 ring-offset-2 ring-offset-[var(--color-background)] ${platform === 'twitch' ? 'ring-[#9146FF]' : 'ring-[#53FC18]'}`}>
                        {channel?.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-lg hover:underline decoration-2 underline-offset-4 decoration-[var(--color-primary)] cursor-pointer">
                          {channel}
                        </span>
                        <span className="text-[var(--color-foreground-muted)] text-sm">1.2M Followers</span>
                      </div>
                    </div>

                    {/* Actions Row */}
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
              <DialogHeader className="hidden">
                <DialogTitle>{selectedClip.title}</DialogTitle>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

