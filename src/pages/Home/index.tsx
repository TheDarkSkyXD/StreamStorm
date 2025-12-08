import { useEffect, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function HomePage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Home</h1>
      <p className="text-[var(--color-foreground-secondary)] mb-8">
        Discover live streams from Twitch and Kick
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
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
          ))
          : [1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-video bg-[var(--color-background-tertiary)] flex items-center justify-center">
                <span className="text-[var(--color-foreground-muted)]">Stream Preview</span>
              </div>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-background-tertiary)]" />
                  <div className="flex-1">
                    <h3 className="font-semibold line-clamp-1">Stream Title {i}</h3>
                    <p className="text-sm text-[var(--color-foreground-secondary)]">Streamer Name</p>
                    <p className="text-sm text-[var(--color-foreground-muted)]">Category • 1.2K viewers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
