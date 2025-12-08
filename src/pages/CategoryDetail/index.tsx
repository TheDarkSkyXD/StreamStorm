
import { useParams, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { Platform } from '@/shared/auth-types';

import { ProxiedImage } from '@/components/ui/proxied-image';
import { Skeleton } from '@/components/ui/skeleton';
import { StreamCard } from '@/components/stream/stream-card';
import { useCategoryById } from '@/hooks/queries/useCategories';
import { useStreamsByCategory } from '@/hooks/queries/useStreams';
import { useQuery } from '@tanstack/react-query';
import { normalizeCategoryName, formatViewerCount } from '@/lib/utils';
import { UnifiedCategory } from '@/backend/api/unified/platform-types';

export function CategoryDetailPage() {
  const { platform, categoryId } = useParams({ from: '/categories/$platform/$categoryId' });

  // 1. Fetch primary category details
  const {
    data: category,
    isLoading: isCategoryLoading
  } = useCategoryById(categoryId, platform as Platform);

  // 2. Determine other platform
  const currentPlatform = platform as Platform;
  const otherPlatform: Platform = currentPlatform === 'twitch' ? 'kick' : 'twitch';

  // 3. Find corresponding category on other platform
  const { data: otherCategory } = useQuery({
    queryKey: ['category-match', category?.name, otherPlatform],
    queryFn: async () => {
      if (!category?.name) return null;
      const normalizedName = normalizeCategoryName(category.name);

      const response = await window.electronAPI.categories.search({
        query: category.name,
        platform: otherPlatform,
        limit: 10
      });

      const candidates = (response.data as UnifiedCategory[]) || [];
      return candidates.find(c => normalizeCategoryName(c.name) === normalizedName) || null;
    },
    enabled: !!category?.name,
    staleTime: 1000 * 60 * 5 // Cache for 5 mins
  });

  // 4. Fetch streams for primary category
  const {
    data: primaryStreams,
    isLoading: isPrimaryStreamsLoading
  } = useStreamsByCategory(categoryId, currentPlatform, 50);

  // 5. Fetch streams for secondary category (if found)
  const {
    data: secondaryStreams,
    isLoading: isSecondaryStreamsLoading
  } = useStreamsByCategory(otherCategory?.id || '', otherPlatform, 50);

  const isLoading = isCategoryLoading || isPrimaryStreamsLoading;

  // 6. Merge and sort streams
  const streams = [
    ...(primaryStreams || []),
    ...(secondaryStreams || [])
  ].sort((a, b) => b.viewerCount - a.viewerCount);

  // Calculate total viewers from streams
  const totalViewers = streams.reduce((acc, stream) => acc + (stream.viewerCount || 0), 0);

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="space-y-4">
            {/* Back Button Skeleton */}
            <div className="h-6 w-32 bg-[var(--color-background-tertiary)] rounded" />

            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="w-48 aspect-[3/4] bg-[var(--color-background-tertiary)] rounded-xl" />
              <div className="flex-1 space-y-4 w-full">
                <div className="h-12 w-3/4 md:w-1/2 bg-[var(--color-background-tertiary)] rounded" />
                <div className="h-6 w-1/4 bg-[var(--color-background-tertiary)] rounded" />
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
              <div className="w-48 aspect-[3/4] bg-[var(--color-background-tertiary)] rounded-xl shadow-2xl flex items-center justify-center shrink-0 border border-[var(--color-border)] relative overflow-hidden group">
                {category?.boxArtUrl ? (
                  <ProxiedImage
                    src={category.boxArtUrl.replace('{width}', '285').replace('{height}', '380')}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="text-6xl">🎮</span>
                )}
                {/* Gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
              </div>
              <div className="flex-1 text-center md:text-left space-y-2 pb-2">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight">{category?.name}</h1>
                <div className="flex items-center justify-center md:justify-start gap-3 text-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[var(--color-primary)] text-xl">{formatViewerCount(totalViewers)}</span>
                    <span className="text-[var(--color-foreground-secondary)]">Viewers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {streams && streams.length > 0 ? (
              streams.map((stream) => (
                <StreamCard key={`${stream.platform}-${stream.id}`} stream={stream} />
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
