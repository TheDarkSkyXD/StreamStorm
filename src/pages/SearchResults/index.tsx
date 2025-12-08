import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import React from 'react';

import type { UnifiedCategory, UnifiedChannel, UnifiedStream, UnifiedVideo, UnifiedClip } from '@/backend/api/unified/platform-types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Clapperboard, Sparkles } from "lucide-react";
import { cn, formatDuration } from '@/lib/utils';
import { useSearchAll } from '@/hooks/queries/useSearch';

// Define SearchTab type
type SearchTab = 'all' | 'channels' | 'streams' | 'videos' | 'clips' | 'categories';

// Platform-agnostic unified search
export function SearchPage() {
  const search: any = useSearch({ from: '/search' });
  const q = search.q as string;
  const [activeTab, setActiveTab] = React.useState<SearchTab>('all');
  const [platformFilter, setPlatformFilter] = React.useState<'all' | 'twitch' | 'kick'>('all');
  const [liveOnly, setLiveOnly] = React.useState(false);
  const [selectedClip, setSelectedClip] = React.useState<UnifiedClip | null>(null);

  // Pass platform filter to the query. Pass undefined if 'all'.
  const { data, isLoading } = useSearchAll(
    q,
    platformFilter === 'all' ? undefined : platformFilter,
    20
  );

  const results = data;

  // Apply Client-Side Filtering (Live Only)
  // Note: Platform filtering is handled by the API via useSearchAll
  const filteredChannels = React.useMemo(() => {
    const channels = results?.channels || [];
    if (liveOnly) {
      return channels.filter(c => c.isLive);
    }
    return channels;
  }, [results?.channels, liveOnly]);

  const filteredStreams = results?.streams || []; // Streams are inherently live

  const filteredCategories = results?.categories || []; // Categories don't have a live state

  const filteredVideos = React.useMemo(() => {
    const videos = results?.videos || [];
    if (liveOnly) return []; // Hide videos when looking for live content
    return videos;
  }, [results?.videos, liveOnly]);

  const filteredClips = React.useMemo(() => {
    const clips = results?.clips || [];
    if (liveOnly) return []; // Hide clips when looking for live content
    return clips;
  }, [results?.clips, liveOnly]);

  // Identify Best Matches from Filtered Results
  const { topMatches, otherMatches } = React.useMemo(() => {
    if (!filteredChannels || !q) return { topMatches: [], otherMatches: filteredChannels || [] };

    const normalizedQuery = q.toLowerCase().trim();
    const top: UnifiedChannel[] = [];
    const others: UnifiedChannel[] = [];

    filteredChannels.forEach(channel => {
      const isExact = channel.username.toLowerCase() === normalizedQuery ||
        channel.displayName.toLowerCase() === normalizedQuery;
      if (isExact) {
        top.push(channel);
      } else {
        others.push(channel);
      }
    });

    return { topMatches: top, otherMatches: others };
  }, [filteredChannels, q]);

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

  const showTopMatches = (activeTab === 'all' || activeTab === 'channels') && topMatches.length > 0;
  const showChannels = (activeTab === 'all' || activeTab === 'channels') && otherMatches.length > 0;
  const showCategories = (activeTab === 'all' || activeTab === 'categories') && filteredCategories.length > 0;
  const showStreams = (activeTab === 'all' || activeTab === 'streams') && filteredStreams.length > 0;
  const showVideos = (activeTab === 'all' || activeTab === 'videos') && filteredVideos.length > 0;
  const showClips = (activeTab === 'all' || activeTab === 'clips') && filteredClips.length > 0;

  // Calculate total count based on filtered results
  const totalResults = (filteredChannels.length) + filteredStreams.length + filteredVideos.length + filteredClips.length + filteredCategories.length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* HEADER & FILTERS */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Search Results for "<span className="text-[var(--color-storm-primary)]">{q}</span>"
          </h1>
          <p className="text-[var(--color-foreground-muted)]">
            Found {totalResults} results
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[var(--color-background-secondary)]/30 p-4 rounded-xl border border-[var(--color-border)]">
          {/* TABS */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
            {(['all', 'channels', 'streams', 'videos', 'clips', 'categories'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-all rounded-lg whitespace-nowrap",
                  activeTab === tab
                    ? "bg-[var(--color-storm-primary)] text-black font-bold shadow-lg shadow-[var(--color-storm-primary)]/20"
                    : "text-[var(--color-foreground-secondary)] hover:bg-white/5 hover:text-white"
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* FILTERS control group */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-6 w-px bg-[var(--color-border)] mx-1 hidden sm:block" />

            {/* Platform Filter */}
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-[var(--color-border)]">
              <button
                onClick={() => setPlatformFilter('all')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  platformFilter === 'all' ? "bg-[var(--color-foreground-secondary)] text-black" : "text-[var(--color-foreground-muted)] hover:text-white"
                )}
              >
                ALL
              </button>
              <button
                onClick={() => setPlatformFilter('twitch')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  platformFilter === 'twitch' ? "bg-[#9146FF] text-white" : "text-[var(--color-foreground-muted)] hover:text-[#9146FF]"
                )}
              >
                TWITCH
              </button>
              <button
                onClick={() => setPlatformFilter('kick')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  platformFilter === 'kick' ? "bg-[#53FC18] text-black" : "text-[var(--color-foreground-muted)] hover:text-[#53FC18]"
                )}
              >
                KICK
              </button>
            </div>

            {/* Live Only Toggle */}
            <button
              onClick={() => setLiveOnly(!liveOnly)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                liveOnly
                  ? "bg-red-500/10 border-red-500 text-red-500"
                  : "bg-transparent border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-red-500/50 hover:text-red-500/80"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full bg-current", liveOnly && "animate-pulse")} />
              LIVE ONLY
            </button>
          </div>
        </div>
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
          {/* BEST MATCHES SECTION */}
          {showTopMatches && (
            <section>
              <h2 className="text-xl font-bold text-[var(--color-storm-primary)] mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> Best Match
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {topMatches.map((channel: UnifiedChannel) => (
                  <Link
                    to="/stream/$platform/$channel"
                    params={{ platform: channel.platform, channel: channel.username }}
                    search={{ tab: 'videos' }}
                    key={channel.id}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-[var(--color-background-secondary)]/50 hover:bg-[var(--color-background-elevated)] transition-all border border-[var(--color-storm-primary)] hover:shadow-lg hover:shadow-[var(--color-storm-primary)]/10"
                  >
                    <div className="relative">
                      <img src={channel.avatarUrl} alt={channel.displayName} className="w-20 h-20 rounded-full object-cover ring-4 ring-[var(--color-storm-primary)]/20 group-hover:ring-[var(--color-storm-primary)] transition-all" />
                      {channel.platform === 'kick' && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#53FC18] rounded-full border-4 border-[var(--color-background)] flex items-center justify-center text-[10px] font-bold text-black">K</div>}
                      {channel.platform === 'twitch' && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#9146FF] rounded-full border-4 border-[var(--color-background)] flex items-center justify-center text-[10px] font-bold text-white">T</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-white truncate">{channel.displayName}</h3>
                      </div>
                      <p className="text-sm text-[var(--color-foreground-secondary)] truncate">
                        {channel.followerCount?.toLocaleString()} followers
                      </p>
                      {channel.isLive && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-bold mt-1 w-fit">
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

          {/* CHANNELS SECTION */}
          {showChannels && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Channels
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {otherMatches.map((channel: UnifiedChannel) => (
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
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-bold">
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
                {filteredCategories.map((category: UnifiedCategory) => (
                  <Link
                    to="/categories/$platform/$categoryId"
                    params={{ platform: category.platform, categoryId: category.id }}
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
                {filteredStreams.map((stream: UnifiedStream) => (
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
                        {(stream.viewerCount || 0).toLocaleString()} viewers
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
                        {stream.platform === 'kick' && <span className="text-[10px] bg-[#53FC18]/20 text-[#53FC18] px-1.5 py-0.5 rounded uppercase font-bold">Kick</span>}
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
                {filteredVideos.map((video: UnifiedVideo) => (
                  <Link
                    to="/video/$platform/$videoId"
                    params={{ platform: video.platform, videoId: video.id }}
                    key={video.id}
                    className="group block rounded-xl overflow-hidden bg-[var(--color-background-secondary)] transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--color-storm-primary)]/10"
                  >
                    <div className="relative aspect-video">
                      <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs backdrop-blur-sm">
                        {formatDuration(video.duration)}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex gap-3">
                        <img src={video.channelAvatar} alt={video.channelName} className="w-10 h-10 rounded-full" />
                        <div className="min-w-0">
                          <h3 className="font-bold text-white truncate group-hover:text-[var(--color-storm-primary)] transition-colors">{video.title}</h3>
                          <p className="text-sm text-[var(--color-foreground-secondary)]">{video.channelDisplayName}</p>
                          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{(video.viewCount || 0).toLocaleString()} views • {new Date(video.publishedAt).toLocaleDateString()}</p>
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
                {filteredClips.map((clip: UnifiedClip) => (
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
                        {formatDuration(clip.duration)}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex gap-2.5">
                        <img src={clip.channelAvatar} alt={clip.channelName} className="w-8 h-8 rounded-full" />
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-white truncate group-hover:text-[var(--color-storm-primary)] transition-colors">{clip.title}</h3>
                          <p className="text-xs text-[var(--color-foreground-secondary)]">{clip.channelDisplayName}</p>
                          <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{(clip.viewCount || 0).toLocaleString()} views</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* EMPTY STATE */}
          {results && filteredChannels.length === 0 && filteredStreams.length === 0 && filteredCategories.length === 0 && filteredVideos.length === 0 && filteredClips.length === 0 && (
            <div className="text-center py-20 bg-[var(--color-background-secondary)]/30 rounded-2xl border border-[var(--color-border)] border-dashed">
              <p className="text-xl text-[var(--color-foreground-secondary)] font-medium">No results found for "{q}"</p>
              <p className="text-[var(--color-foreground-muted)] mt-2">Try adjusting your filters or checking your spelling.</p>
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
