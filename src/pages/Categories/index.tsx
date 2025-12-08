import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CategoriesPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Categories</h1>
      <p className="text-[var(--color-foreground-secondary)] mb-8">
        Browse streams by game or category
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
          : ['Just Chatting', 'Fortnite', 'Valorant', 'League of Legends', 'Minecraft', 'GTA V', 'Counter-Strike', 'Apex Legends'].map((category) => (
            <Link
              key={category}
              to="/categories/$categoryId"
              params={{ categoryId: category }}
              className="block"
            >
              <Card className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-white transition-all h-full">
                <div className="aspect-[3/4] bg-[var(--color-background-tertiary)] flex items-center justify-center">
                  <span className="text-2xl">🎮</span>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-1">{category}</h3>
                  <p className="text-xs text-[var(--color-foreground-muted)]">12.5K viewers</p>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  );
}
