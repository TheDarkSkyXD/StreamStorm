
import { useEffect, useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

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
  { id: 4, name: 'AdinRoss', game: 'Just Chatting', isLive: true, platform: 'kick', thumbnailColor: 'bg-emerald-600', title: 'HUGE WINS TONIGHT', viewerCount: 45000 },
  { id: 5, name: 'Pokimane', game: 'League of Legends', isLive: true, platform: 'twitch', thumbnailColor: 'bg-purple-500', title: 'Ranked Climb to Diamond', viewerCount: 8500 },
  { id: 6, name: 'Trainwreck', game: 'Just Chatting', isLive: true, platform: 'kick', thumbnailColor: 'bg-lime-600', title: 'GIVEAWAYS !kick', viewerCount: 12000 },
  { id: 7, name: 'KaiCenat', game: 'Just Chatting', isLive: true, platform: 'twitch', thumbnailColor: 'bg-orange-500', title: 'MAFIATHON START!', viewerCount: 85420 },
  { id: 8, name: 'Amouranth', game: 'Just Chatting', isLive: true, platform: 'kick', thumbnailColor: 'bg-pink-500', title: 'ASMR Ear Licking', viewerCount: 12300 },
  { id: 9, name: 'HasanAbi', game: 'Just Chatting', isLive: true, platform: 'twitch', thumbnailColor: 'bg-red-500', title: 'NEWS DAY! REACTING TO...', viewerCount: 25600 },
  { id: 10, name: 'Summit1g', game: 'Counter-Strike', isLive: true, platform: 'twitch', thumbnailColor: 'bg-blue-600', title: '1G in CS2', viewerCount: 18000 },
  { id: 11, name: 'Asmongold', game: 'League of Legends', isLive: true, platform: 'twitch', thumbnailColor: 'bg-yellow-600', title: 'ICC RAID TONIGHT', viewerCount: 45200 },
  { id: 12, name: 'Roshtein', game: 'Just Chatting', isLive: true, platform: 'kick', thumbnailColor: 'bg-emerald-500', title: 'MAX WIN HUNTING', viewerCount: 18900 },
  { id: 13, name: 'MoistCr1TiKaL', game: 'Just Chatting', isLive: true, platform: 'twitch', thumbnailColor: 'bg-sky-500', title: 'Big Announcement', viewerCount: 22000 },
  { id: 14, name: 'Ludwig', game: 'Valorant', isLive: true, platform: 'twitch', thumbnailColor: 'bg-rose-400', title: 'Mogul Move', viewerCount: 15000 },
  { id: 15, name: 'TimTheTatman', game: 'Call of Duty', isLive: true, platform: 'twitch', thumbnailColor: 'bg-amber-500', title: 'SPECTATING SOLOS', viewerCount: 28400 },
  { id: 16, name: 'DrDisrespect', game: 'Apex Legends', isLive: true, platform: 'kick', thumbnailColor: 'bg-red-600', title: 'V SM COMMAND', viewerCount: 35000 },
  { id: 17, name: 'GMHikaru', game: 'Chess', isLive: true, platform: 'kick', thumbnailColor: 'bg-slate-500', title: 'Speed Chess Championship', viewerCount: 10500 },
  { id: 18, name: 'Tfue', game: 'Fortnite', isLive: true, platform: 'twitch', thumbnailColor: 'bg-teal-500', title: 'Scoped in', viewerCount: 9000 },
  { id: 19, name: 'Kyedae', game: 'Valorant', isLive: true, platform: 'twitch', thumbnailColor: 'bg-violet-500', title: 'Ranked with TenZ', viewerCount: 15600 },
  { id: 20, name: 'TenZ', game: 'Valorant', isLive: true, platform: 'twitch', thumbnailColor: 'bg-indigo-400', title: 'Radiant Gameplay', viewerCount: 21000 },
  { id: 21, name: 'Clix', game: 'Fortnite', isLive: true, platform: 'twitch', thumbnailColor: 'bg-fuchsia-500', title: 'FNCS FINALS', viewerCount: 22100 },
  { id: 22, name: 'Ice Poseidon', game: 'IRL', isLive: true, platform: 'kick', thumbnailColor: 'bg-purple-600', title: 'Travel Stream !locations', viewerCount: 8900 },
  { id: 23, name: 'Destiny', game: 'Just Chatting', isLive: true, platform: 'kick', thumbnailColor: 'bg-blue-500', title: 'Debate Review', viewerCount: 5000 },
  { id: 24, name: 'Sodapoppin', game: 'League of Legends', isLive: true, platform: 'twitch', thumbnailColor: 'bg-green-600', title: 'Hardcore Leveling', viewerCount: 18000 },
  { id: 25, name: 'LIRIK', game: 'GTA V', isLive: true, platform: 'twitch', thumbnailColor: 'bg-stone-500', title: 'Sub Sunday', viewerCount: 21000 },
  { id: 26, name: 'Symfuhny', game: 'Call of Duty', isLive: true, platform: 'twitch', thumbnailColor: 'bg-yellow-400', title: 'Warzone Nuke??', viewerCount: 11000 },
  { id: 27, name: 'NICKMERCS', game: 'Apex Legends', isLive: true, platform: 'kick', thumbnailColor: 'bg-red-500', title: 'MFAM', viewerCount: 20000 },
  { id: 28, name: 'Sapnap', game: 'Minecraft', isLive: true, platform: 'kick', thumbnailColor: 'bg-orange-600', title: 'Speedrunning', viewerCount: 15000 },
  { id: 29, name: 'GeorgeNotFound', game: 'Minecraft', isLive: true, platform: 'twitch', thumbnailColor: 'bg-blue-400', title: 'Manhunt', viewerCount: 25000 },
  { id: 30, name: 'Dream', game: 'Minecraft', isLive: true, platform: 'twitch', thumbnailColor: 'bg-green-400', title: 'Coding a new plugin', viewerCount: 40000 },
  { id: 31, name: 'Tarik', game: 'Valorant', isLive: true, platform: 'twitch', thumbnailColor: 'bg-cyan-500', title: 'Watch Party', viewerCount: 30000 },
  { id: 32, name: 'Summit1g', game: 'GTA V', isLive: true, platform: 'twitch', thumbnailColor: 'bg-blue-600', title: 'RP NoPixel', viewerCount: 18000 },
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

export function CategoryDetailPage() {
  const { categoryId } = useParams({ from: '/categories/$categoryId' });
  const decodedCategory = decodeURIComponent(categoryId);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial loading
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [categoryId]);

  // Filter channels based on the category
  const categoryStreams = MOCK_CHANNELS.filter(channel =>
    channel.game.toLowerCase() === decodedCategory.toLowerCase() ||
    channel.game.toLowerCase().includes(decodedCategory.toLowerCase()) ||
    decodedCategory.toLowerCase().includes(channel.game.toLowerCase())
  );

  // Calculate total viewers
  const totalViewers = categoryStreams.reduce((acc, channel) => acc + (channel.viewerCount || 0), 0);

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="space-y-4">
            {/* Back Button Skeleton */}
            <div className="h-6 w-32 bg-[var(--color-background-tertiary)] rounded" />

            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="w-48 aspect-[2/3] bg-[var(--color-background-tertiary)] rounded-xl" />
              <div className="flex-1 space-y-4 w-full">
                <div className="h-12 w-3/4 md:w-1/2 bg-[var(--color-background-tertiary)] rounded" />
                <div className="h-6 w-1/4 bg-[var(--color-background-tertiary)] rounded" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-16 bg-[var(--color-background-tertiary)] rounded-full" />
                  <div className="h-6 w-16 bg-[var(--color-background-tertiary)] rounded-full" />
                  <div className="h-6 w-16 bg-[var(--color-background-tertiary)] rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <div className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            <Link to="/categories" className="text-[var(--color-foreground-muted)] hover:text-white flex items-center gap-2 transition-colors w-fit">
              <ArrowLeft size={20} />
              Back to Categories
            </Link>

            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="w-48 aspect-[2/3] bg-[var(--color-background-tertiary)] rounded-xl shadow-2xl flex items-center justify-center text-6xl shrink-0 border border-[var(--color-border)] relative overflow-hidden group">
                <span className="scale-100 group-hover:scale-110 transition-transform duration-500">🎮</span>
                {/* Gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
              </div>
              <div className="flex-1 text-center md:text-left space-y-2 pb-2">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight">{decodedCategory}</h1>
                <div className="flex items-center justify-center md:justify-start gap-3 text-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[var(--color-primary)] text-xl">{formatViewers(totalViewers)}</span>
                    <span className="text-[var(--color-foreground-secondary)]">Viewers</span>
                  </div>
                </div>
                {/* Mock tags */}
                <div className="flex gap-2 justify-center md:justify-start pt-2">
                  <span className="px-3 py-1 rounded-full bg-[var(--color-background-tertiary)] text-xs font-semibold text-[var(--color-foreground-secondary)] hover:text-white cursor-pointer transition-colors">FPS</span>
                  <span className="px-3 py-1 rounded-full bg-[var(--color-background-tertiary)] text-xs font-semibold text-[var(--color-foreground-secondary)] hover:text-white cursor-pointer transition-colors">Shooter</span>
                  <span className="px-3 py-1 rounded-full bg-[var(--color-background-tertiary)] text-xs font-semibold text-[var(--color-foreground-secondary)] hover:text-white cursor-pointer transition-colors">Action</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categoryStreams.length > 0 ? (
              categoryStreams.map((channel) => (
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
                          {channel.viewerCount?.toLocaleString()} viewers
                        </div>
                      )}
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
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-[var(--color-foreground-muted)]">
                <p className="text-lg font-medium">No active streams found for this category.</p>
                <p className="text-sm">Try checking back later!</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
