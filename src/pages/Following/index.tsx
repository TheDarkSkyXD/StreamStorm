import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Platform = 'all' | 'twitch' | 'kick';

interface Channel {
  id: number;
  name: string;
  game: string;
  isLive: boolean;
  platform: 'twitch' | 'kick';
  thumbnailColor: string;
  title?: string;
  viewerCount?: number;
}

const MOCK_CHANNELS: Channel[] = [
  { id: 1, name: 'Ninja', game: 'Fortnite', isLive: true, platform: 'twitch', thumbnailColor: 'bg-indigo-500', title: 'CRANKING 90s! !drops', viewerCount: 15432 },
  { id: 2, name: 'xQc', game: 'Just Chatting', isLive: true, platform: 'kick', thumbnailColor: 'bg-green-500', title: 'GAMBA GAMBA GAMBA', viewerCount: 32109 },
  { id: 3, name: 'Shroud', game: 'Valorant', isLive: false, platform: 'twitch', thumbnailColor: 'bg-cyan-600', title: 'Pro Valo Gameplay' },
  { id: 4, name: 'AdinRoss', game: 'Slots', isLive: false, platform: 'kick', thumbnailColor: 'bg-emerald-600', title: 'HUGE WINS TONIGHT' },
  { id: 5, name: 'Pokimane', game: 'LoL', isLive: true, platform: 'twitch', thumbnailColor: 'bg-purple-500', title: 'Ranked Climb to Diamond', viewerCount: 8500 },
  { id: 6, name: 'Trainwreck', game: 'Gambling', isLive: false, platform: 'kick', thumbnailColor: 'bg-lime-600', title: 'GIVEAWAYS !kick' },
  { id: 7, name: 'KaiCenat', game: 'Just Chatting', isLive: true, platform: 'twitch', thumbnailColor: 'bg-orange-500', title: 'MAFIATHON START!', viewerCount: 85420 },
  { id: 8, name: 'Amouranth', game: 'ASMR', isLive: true, platform: 'kick', thumbnailColor: 'bg-pink-500', title: 'ASMR Ear Licking', viewerCount: 12300 },
  { id: 9, name: 'HasanAbi', game: 'Just Chatting', isLive: true, platform: 'twitch', thumbnailColor: 'bg-red-500', title: 'NEWS DAY! REACTING TO...', viewerCount: 25600 },
  { id: 10, name: 'Summit1g', game: 'CS2', isLive: false, platform: 'twitch', thumbnailColor: 'bg-blue-600', title: '1G' },
  { id: 11, name: 'Asmongold', game: 'WoW', isLive: true, platform: 'twitch', thumbnailColor: 'bg-yellow-600', title: 'ICC RAID TONIGHT', viewerCount: 45200 },
  { id: 12, name: 'Roshtein', game: 'Slots', isLive: true, platform: 'kick', thumbnailColor: 'bg-emerald-500', title: 'MAX WIN HUNTING', viewerCount: 18900 },
  { id: 13, name: 'MoistCr1TiKaL', game: 'Just Chatting', isLive: false, platform: 'twitch', thumbnailColor: 'bg-sky-500', title: 'Big Announcement' },
  { id: 14, name: 'Ludwig', game: 'YouTube', isLive: false, platform: 'twitch', thumbnailColor: 'bg-rose-400', title: 'Mogul Move' },
  { id: 15, name: 'TimTheTatman', game: 'Call of Duty', isLive: true, platform: 'twitch', thumbnailColor: 'bg-amber-500', title: 'SPECTATING SOLOS', viewerCount: 28400 },
  { id: 16, name: 'DrDisrespect', game: 'Warzone', isLive: false, platform: 'kick', thumbnailColor: 'bg-red-600', title: 'V SM COMMAND' },
  { id: 17, name: 'GMHikaru', game: 'Chess', isLive: true, platform: 'kick', thumbnailColor: 'bg-slate-500', title: 'Speed Chess Championship', viewerCount: 10500 },
  { id: 18, name: 'Tfue', game: 'Fortnite', isLive: false, platform: 'twitch', thumbnailColor: 'bg-teal-500', title: 'Scoped in' },
  { id: 19, name: 'Kyedae', game: 'Valorant', isLive: true, platform: 'twitch', thumbnailColor: 'bg-violet-500', title: 'Ranked with TenZ', viewerCount: 15600 },
  { id: 20, name: 'TenZ', game: 'Valorant', isLive: false, platform: 'twitch', thumbnailColor: 'bg-indigo-400', title: 'Radiant Gameplay' },
  { id: 21, name: 'Clix', game: 'Fortnite', isLive: true, platform: 'twitch', thumbnailColor: 'bg-fuchsia-500', title: 'FNCS FINALS', viewerCount: 22100 },
  { id: 22, name: 'Ice Poseidon', game: 'IRL', isLive: true, platform: 'kick', thumbnailColor: 'bg-purple-600', title: 'Travel Stream !locations', viewerCount: 8900 },
  { id: 23, name: 'Destiny', game: 'Just Chatting', isLive: false, platform: 'kick', thumbnailColor: 'bg-blue-500', title: 'Debate Review' },
  { id: 24, name: 'Sodapoppin', game: 'WoW', isLive: false, platform: 'twitch', thumbnailColor: 'bg-green-600', title: 'Hardcore Leveling' },
  { id: 25, name: 'LIRIK', game: 'Variety', isLive: true, platform: 'twitch', thumbnailColor: 'bg-stone-500', title: 'Sub Sunday', viewerCount: 21000 },
];

// Helper to format viewer counts (e.g. 1200 -> 1.2K)
function formatViewers(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

export function FollowingPage() {
  const [filter, setFilter] = useState<Platform>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const filteredChannels = MOCK_CHANNELS.filter((channel) => {
    const matchesPlatform = filter === 'all' || channel.platform === filter;
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const liveChannels = filteredChannels.filter((c) => c.isLive);
  const offlineChannels = filteredChannels.filter((c) => !c.isLive);

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">❤️ Following</h1>
        <p className="text-[var(--color-foreground-secondary)]">
          Channels you follow across Twitch and Kick
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[var(--color-background-secondary)] p-4 rounded-xl border border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-white text-black hover:bg-white/90' : ''}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={filter === 'twitch' ? 'default' : 'secondary'}
            onClick={() => setFilter('twitch')}
            className={filter === 'twitch' ? 'bg-[#9146FF] hover:bg-[#9146FF]/90 text-white' : ''}
            size="sm"
          >
            Twitch
          </Button>
          <Button
            variant={filter === 'kick' ? 'default' : 'secondary'}
            onClick={() => setFilter('kick')}
            className={filter === 'kick' ? 'bg-[#53FC18] hover:bg-[#53FC18]/90 text-black' : ''}
            size="sm"
          >
            Kick
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-foreground-muted)]" />
          <input
            type="text"
            placeholder="Search followed channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md bg-[var(--color-background-tertiary)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-white transition-all placeholder:text-[var(--color-foreground-muted)]"
          />
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="space-y-8">
            {/* Live Section Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-7 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                    <Skeleton className="aspect-video w-full" />
                    <div className="p-4 flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Offline Section Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-7 w-24" />
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Live Section */}
            {liveChannels.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Live Now
                </h2>
                <div className="max-h-[45vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveChannels.map((channel) => (
                      <Link
                        key={channel.id}
                        to="/stream/$platform/$channel"
                        params={{ platform: channel.platform, channel: channel.name }}
                        search={{ tab: 'videos' }}
                        className="block group"
                      >
                        <Card className="overflow-hidden hover:border-white transition-colors cursor-pointer h-full">
                          <div className={`aspect-video ${channel.thumbnailColor} relative`}>
                            <span className="absolute top-2 left-2 badge-live z-10">LIVE</span>
                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white font-medium capitalize flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${channel.platform === 'twitch' ? 'bg-[#9146FF]' : 'bg-[#53FC18]'}`} />
                              {channel.platform}
                            </div>
                            {channel.viewerCount && (
                              <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white font-medium flex items-center gap-1.5">
                                {formatViewers(channel.viewerCount)} viewers
                              </div>
                            )}
                            <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white font-medium">
                              4:20:00
                            </div>
                          </div>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full ${channel.thumbnailColor} shrink-0 ring-2 ring-transparent group-hover:ring-[var(--color-primary)] transition-all`} />
                              <div className="min-w-0">
                                <h3 className="font-semibold truncate group-hover:text-[var(--color-primary)] transition-colors">{channel.name}</h3>
                                {channel.title && (
                                  <p className="text-sm text-white font-bold truncate">{channel.title}</p>
                                )}
                                <p className="text-xs text-[var(--color-foreground-secondary)] mt-0.5">{channel.game}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Offline Section */}
            {offlineChannels.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Offline</h2>
                <div className="max-h-[35vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-2">
                    {offlineChannels.map((channel) => (
                      <Link
                        key={channel.id}
                        to="/stream/$platform/$channel"
                        params={{ platform: channel.platform, channel: channel.name }}
                        search={{ tab: 'videos' }}
                        className="text-center group cursor-pointer block"
                      >
                        <div className="relative inline-block">
                          <div className={`w-16 h-16 mx-auto rounded-full ${channel.thumbnailColor} mb-2 ring-2 ring-transparent group-hover:ring-[var(--color-primary)] transition-all`} />
                          <div className={`absolute bottom-2 right-0 w-4 h-4 rounded-full border-2 border-[var(--color-background)] ${channel.platform === 'twitch' ? 'bg-[#9146FF]' : 'bg-[#53FC18]'}`} />
                        </div>
                        <p className="text-sm font-medium group-hover:text-[var(--color-primary)] transition-colors">{channel.name}</p>
                        <p className="text-xs text-[var(--color-foreground-muted)]">Offline</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {liveChannels.length === 0 && offlineChannels.length === 0 && (
              <div className="text-center py-12 text-[var(--color-foreground-muted)]">
                <p>No channels found matching your filters.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
