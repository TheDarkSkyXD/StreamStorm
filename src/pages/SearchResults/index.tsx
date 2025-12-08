import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import React from 'react';

import type { UnifiedCategory, UnifiedChannel, UnifiedStream } from '@/backend/api/unified';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Clapperboard } from "lucide-react";
import { cn } from '@/lib/utils';

type SearchTab = 'all' | 'channels' | 'streams' | 'videos' | 'clips' | 'categories';

interface UnifiedVideo {
  id: string;
  platform: 'twitch' | 'kick';
  channelId: string;
  channelName: string;
  channelDisplayName: string;
  channelAvatar: string;
  title: string;
  viewCount: number;
  thumbnailUrl: string;
  duration: string;
  createdAt: string;
}

interface UnifiedClip {
  id: string;
  platform: 'twitch' | 'kick';
  channelId: string;
  channelName: string;
  channelDisplayName: string;
  channelAvatar: string;
  title: string;
  viewCount: number;
  thumbnailUrl: string;
  duration: string;
  createdAt: string;
  embedUrl: string;
}

// Mock Data Generators
const mockChannels: UnifiedChannel[] = [
  {
    id: '1',
    platform: 'twitch',
    username: 'ninja',
    displayName: 'Ninja',
    avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/3f6ed82a-3029-4379-8928-199a9110d700-profile_image-70x70.png',
    isLive: true,
    isVerified: true,
    isPartner: true,
    followerCount: 19000000,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    platform: 'kick',
    username: 'xqc',
    displayName: 'xQc',
    avatarUrl: 'https://files.kick.com/images/user/285994/profile_image/3295842/webp',
    isLive: false,
    isVerified: true,
    isPartner: true,
    followerCount: 500000,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    platform: 'twitch',
    username: 'shroud',
    displayName: 'shroud',
    avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/7ed5e0c6-0191-4eef-8328-481ecaa05232-profile_image-70x70.png',
    isLive: true,
    isVerified: true,
    isPartner: true,
    followerCount: 10000000,
    createdAt: new Date().toISOString()
  }
];

const mockStreams: UnifiedStream[] = [
  {
    id: '101',
    platform: 'twitch',
    channelId: '1',
    channelName: 'ninja',
    channelDisplayName: 'Ninja',
    channelAvatar: 'https://static-cdn.jtvnw.net/jtv_user_pictures/3f6ed82a-3029-4379-8928-199a9110d700-profile_image-70x70.png',
    title: 'Fortnite Customs! !prime',
    viewerCount: 15432,
    thumbnailUrl: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_ninja-440x248.jpg',
    isLive: true,
    startedAt: new Date().toISOString(),
    language: 'en',
    tags: ['Fortnite', 'Battle Royale'],
    categoryName: 'Fortnite'
  }
];

const mockCategories: UnifiedCategory[] = [
  {
    id: 'c1',
    platform: 'twitch',
    name: 'Just Chatting',
    boxArtUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-188x250.jpg'
  },
  {
    id: 'c2',
    platform: 'kick',
    name: 'Slots & Casino',
    boxArtUrl: 'https://files.kick.com/images/subcategories/20/banner/webp'
  },
  {
    id: 'c3',
    platform: 'twitch',
    name: 'Valorant',
    boxArtUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-188x250.jpg'
  }
];

const mockVideos: UnifiedVideo[] = [
  {
    id: 'v1',
    platform: 'twitch',
    channelId: '1',
    channelName: 'ninja',
    channelDisplayName: 'Ninja',
    channelAvatar: 'https://static-cdn.jtvnw.net/jtv_user_pictures/3f6ed82a-3029-4379-8928-199a9110d700-profile_image-70x70.png',
    title: 'Previous Broadcast: Fortnite Customs',
    viewCount: 120000,
    thumbnailUrl: 'https://static-cdn.jtvnw.net/cf_vods/d3vd9lfkzbru3h/44ce842426027aeb07be_ninja_41876310151_1677242835//thumb/thumb0-320x180.jpg',
    duration: '4:20:30',
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'v2',
    platform: 'kick',
    channelId: '2',
    channelName: 'xqc',
    channelDisplayName: 'xQc',
    channelAvatar: 'https://files.kick.com/images/user/285994/profile_image/3295842/webp',
    title: 'Reacting to Tik Toks',
    viewCount: 50000,
    thumbnailUrl: 'https://files.kick.com/images/livestream/12345/banner.webp', // Placeholder
    duration: '6:10:15',
    createdAt: new Date(Date.now() - 172800000).toISOString()
  }
];

const mockClips: UnifiedClip[] = [
  {
    id: 'cl1',
    platform: 'twitch',
    channelId: '3',
    channelName: 'shroud',
    channelDisplayName: 'shroud',
    channelAvatar: 'https://static-cdn.jtvnw.net/jtv_user_pictures/7ed5e0c6-0191-4eef-8328-481ecaa05232-profile_image-70x70.png',
    title: 'Insane 1v5 Clutch!',
    viewCount: 5432,
    thumbnailUrl: 'https://static-cdn.jtvnw.net/cf_vods/d3vd9lfkzbru3h/44ce842426027aeb07be_shroud_41876310151_1677242835//thumb/thumb0-320x180.jpg',
    duration: '0:30',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    embedUrl: 'https://clips.twitch.tv/embed?clip=AwkwardHelplessSalamanderSwiftRage&parent=localhost'
  },
  {
    id: 'cl2',
    platform: 'kick',
    channelId: '2',
    channelName: 'xqc',
    channelDisplayName: 'xQc',
    channelAvatar: 'https://files.kick.com/images/user/285994/profile_image/3295842/webp',
    title: 'FUNNY FAIL',
    viewCount: 1200,
    thumbnailUrl: 'https://files.kick.com/images/livestream/12345/banner.webp',
    duration: '0:15',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    embedUrl: 'https://player.kick.com/xqc' // Mock embed
  }
];

export function SearchPage() {
  const search: any = useSearch({ from: '/search' });
  const q = search.q as string;
  const [activeTab, setActiveTab] = React.useState<SearchTab>('all');
  const [selectedClip, setSelectedClip] = React.useState<UnifiedClip | null>(null);

  // Simulated search query
  const { data, isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600));

      if (!q) return { channels: [], streams: [], videos: [], clips: [], categories: [] };

      const queryLower = q.toLowerCase();

      return {
        channels: mockChannels.filter(c => c.username.includes(queryLower) || c.displayName.toLowerCase().includes(queryLower)),
        streams: mockStreams.filter(s => s.title.toLowerCase().includes(queryLower) || s.channelName.includes(queryLower)),
        videos: mockVideos.filter(v => v.title.toLowerCase().includes(queryLower) || v.channelName.includes(queryLower)),
        clips: mockClips.filter(c => c.title.toLowerCase().includes(queryLower) || c.channelName.includes(queryLower)),
        categories: mockCategories.filter(c => c.name.toLowerCase().includes(queryLower))
      };
    },
    enabled: !!q
  });

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-12 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-[var(--color-background-secondary)] rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--color-foreground-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Search StreamStorm</h2>
        <p className="text-[var(--color-foreground-secondary)] max-w-sm">
          Search for your favorite channels, streams, and categories across Twitch and Kick.
        </p>
      </div>
    )
  }

  const showChannels = (activeTab === 'all' || activeTab === 'channels') && data?.channels && data.channels.length > 0;
  const showCategories = (activeTab === 'all' || activeTab === 'categories') && data?.categories && data.categories.length > 0;
  const showStreams = (activeTab === 'all' || activeTab === 'streams') && data?.streams && data.streams.length > 0;
  const showVideos = (activeTab === 'all' || activeTab === 'videos') && data?.videos && data.videos.length > 0;
  const showClips = (activeTab === 'all' || activeTab === 'clips') && data?.clips && data.clips.length > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Search Results for "<span className="text-[var(--color-storm-primary)]">{q}</span>"
        </h1>
        <p className="text-[var(--color-foreground-muted)]">
          Found {data ? (data.channels.length + data.streams.length + data.videos.length + data.clips.length + data.categories.length) : 0} results
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-1">
        {(['all', 'channels', 'streams', 'videos', 'clips', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === tab
                ? "text-white"
                : "text-[var(--color-foreground-secondary)] hover:text-white"
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <div className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-[var(--color-storm-primary)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-10">
          {/* CHANNELS SKELETON */}
          <section>
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)]">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CATEGORIES SKELETON */}
          <section>
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          </section>

          {/* STREAMS SKELETON */}
          <section>
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-xl" />
                  <div className="flex gap-3">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* VIDEOS SKELETON */}
          <section>
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-xl" />
                  <div className="flex gap-3">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CLIPS SKELETON */}
          <section>
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-xl" />
                  <div className="flex gap-3">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-10">
          {/* CHANNELS SECTION */}
          {showChannels && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Channels
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.channels.map(channel => (
                  <Link
                    to="/stream/$platform/$channel"
                    params={{ platform: channel.platform, channel: channel.username }}
                    search={{ tab: 'videos' }}
                    key={channel.id}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-[var(--color-background-secondary)] hover:bg-[var(--color-background-elevated)] transition-all border border-[var(--color-border)] hover:border-[var(--color-storm-primary)]/50"
                  >
                    <div className="relative">
                      <img src={channel.avatarUrl} alt={channel.displayName} className="w-16 h-16 rounded-full object-cover ring-2 ring-[var(--color-background)] group-hover:ring-[var(--color-storm-primary)] transition-all" />
                      {channel.platform === 'kick' && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#53FC18] rounded-full border-2 border-[var(--color-background)] flex items-center justify-center text-[10px] font-bold text-black">K</div>}
                      {channel.platform === 'twitch' && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#9146FF] rounded-full border-2 border-[var(--color-background)] flex items-center justify-center text-[10px] font-bold text-white">T</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white truncate">{channel.displayName}</h3>
                      </div>
                      <p className="text-sm text-[var(--color-foreground-secondary)] truncate">
                        {channel.followerCount?.toLocaleString()} followers
                      </p>
                      {channel.isLive && (
                        <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CATEGORIES SECTION */}
          {showCategories && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Categories
              </h2>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {data.categories.map(category => (
                  <Link
                    to="/categories/$categoryId"
                    params={{ categoryId: category.id }}
                    key={category.id}
                    className="group block relative aspect-[3/4] rounded-lg overflow-hidden bg-[var(--color-background-secondary)]"
                  >
                    <img src={category.boxArtUrl} alt={category.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <p className="text-white font-bold text-sm truncate w-full">{category.name}</p>
                    </div>
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white backdrop-blur-sm uppercase">
                      {category.platform}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* STREAMS SECTION */}
          {showStreams && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Streams
              </h2>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {data.streams.map(stream => (
                  <Link
                    to="/stream/$platform/$channel"
                    params={{ platform: stream.platform, channel: stream.channelName }}
                    search={{ tab: 'videos' }}
                    key={stream.id}
                    className="group block rounded-xl overflow-hidden bg-[var(--color-background-secondary)] transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--color-storm-primary)]/10"
                  >
                    <div className="relative aspect-video">
                      <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold flex items-center gap-1">
                        LIVE
                      </div>
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs backdrop-blur-sm">
                        {stream.viewerCount.toLocaleString()} viewers
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex gap-3">
                        <img src={stream.channelAvatar} alt={stream.channelName} className="w-10 h-10 rounded-full" />
                        <div className="min-w-0">
                          <h3 className="font-bold text-white truncate group-hover:text-[var(--color-storm-primary)] transition-colors">{stream.title}</h3>
                          <p className="text-sm text-[var(--color-foreground-secondary)]">{stream.channelDisplayName}</p>
                          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{stream.categoryName}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {stream.platform === 'twitch' && <span className="text-[10px] bg-[#9146FF]/20 text-[#9146FF] px-1.5 py-0.5 rounded uppercase font-bold">Twitch</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}


          {/* VIDEOS SECTION */}
          {showVideos && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-[var(--color-storm-primary)]" /> Videos
              </h2>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {data.videos.map(video => (
                  <Link
                    to="/video/$platform/$videoId"
                    params={{ platform: video.platform, videoId: video.id }}
                    key={video.id}
                    className="group block rounded-xl overflow-hidden bg-[var(--color-background-secondary)] transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--color-storm-primary)]/10"
                  >
                    <div className="relative aspect-video">
                      <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs backdrop-blur-sm">
                        {video.duration}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex gap-3">
                        <img src={video.channelAvatar} alt={video.channelName} className="w-10 h-10 rounded-full" />
                        <div className="min-w-0">
                          <h3 className="font-bold text-white truncate group-hover:text-[var(--color-storm-primary)] transition-colors">{video.title}</h3>
                          <p className="text-sm text-[var(--color-foreground-secondary)]">{video.channelDisplayName}</p>
                          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{video.viewCount.toLocaleString()} views • {new Date(video.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CLIPS SECTION */}
          {showClips && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clapperboard className="w-5 h-5 text-white" /> Clips
              </h2>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {data.clips.map(clip => (
                  <div
                    onClick={() => setSelectedClip(clip)}
                    key={clip.id}
                    className="group cursor-pointer rounded-xl overflow-hidden bg-[var(--color-background-secondary)] transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--color-storm-primary)]/10"
                  >
                    <div className="relative aspect-video">
                      <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      </div>

                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs backdrop-blur-sm">
                        {clip.duration}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex gap-2.5">
                        <img src={clip.channelAvatar} alt={clip.channelName} className="w-8 h-8 rounded-full" />
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-white truncate group-hover:text-[var(--color-storm-primary)] transition-colors">{clip.title}</h3>
                          <p className="text-xs text-[var(--color-foreground-secondary)]">{clip.channelDisplayName}</p>
                          <p className="text-[10px] text-[var(--color-foreground-muted)] mt-0.5">{clip.viewCount.toLocaleString()} views</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* EMPTY STATE */}
          {data && data.channels.length === 0 && data.streams.length === 0 && data.categories.length === 0 && data.videos.length === 0 && data.clips.length === 0 && (
            <div className="text-center py-20 bg-[var(--color-background-secondary)]/30 rounded-2xl border border-[var(--color-border)] border-dashed">
              <p className="text-xl text-[var(--color-foreground-secondary)] font-medium">No results found for "{q}"</p>
              <p className="text-[var(--color-foreground-muted)] mt-2">Try checking your spelling or searching for something else.</p>
            </div>
          )}
        </div>
      )}
      <Dialog open={!!selectedClip} onOpenChange={(open) => !open && setSelectedClip(null)}>
        <DialogContent className="max-w-4xl bg-black border-[var(--color-border)] p-0 overflow-hidden">
          {selectedClip && (
            <>
              <div className="aspect-video bg-black relative flex items-center justify-center">
                {/* Placeholder for clip player */}
                <div className="text-center">
                  <p className="text-white font-bold text-lg mb-2">Playing Clip: {selectedClip.title}</p>
                  <p className="text-[var(--color-foreground-muted)]">Source: {selectedClip.embedUrl}</p>
                </div>
              </div>
              <DialogHeader className="hidden">
                <DialogTitle>{selectedClip.title}</DialogTitle>
              </DialogHeader>
              <div className="p-4 bg-[var(--color-background-secondary)]">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {selectedClip.title}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <img src={selectedClip.channelAvatar} className="w-6 h-6 rounded-full" />
                  <span className="text-sm text-[var(--color-foreground-secondary)]">Clipped by {selectedClip.channelDisplayName}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
