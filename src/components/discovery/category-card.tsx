import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import React from "react";

import type { UnifiedCategory } from "@/backend/api/unified/platform-types";
import { Card, CardContent } from "@/components/ui/card";
import { ProxiedImage } from "@/components/ui/proxied-image";
import { STREAM_KEYS } from "@/hooks/queries/useStreams";
import { formatViewerCount } from "@/lib/utils";

interface CategoryCardProps {
  category: UnifiedCategory;
}

// Memoize CategoryCard to prevent re-renders when grid updates but individual category hasn't changed
export const CategoryCard = React.memo(({ category }: CategoryCardProps) => {
  const queryClient = useQueryClient();

  // Prefetch category streams on hover for instant navigation
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: STREAM_KEYS.byCategory(category.id, category.platform),
      queryFn: async () => {
        const response = await window.electronAPI.streams.getByCategory({
          categoryId: category.id,
          platform: category.platform,
          limit: 20,
        });
        if (response.error) throw new Error(response.error as string);
        return response.data;
      },
    });
  };

  return (
    <Link
      to="/categories/$platform/$categoryId"
      params={{
        platform: category.platform,
        categoryId: category.id,
      }}
      className="block h-full"
      onMouseEnter={handleMouseEnter}
    >
      <Card className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-white transition-all h-full group bg-[var(--color-background-secondary)] border-transparent">
        <div className="aspect-[3/4] bg-[var(--color-background-tertiary)] relative overflow-hidden">
          <ProxiedImage
            src={category.boxArtUrl.replace("{width}", "285").replace("{height}", "380")}
            alt={category.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            fallback={
              <div className="w-full h-full flex items-center justify-center text-4xl">🎮</div>
            }
          />
        </div>
        <CardContent className="p-3">
          <h3
            className="font-semibold text-sm line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors"
            title={category.name}
          >
            {category.name}
          </h3>
          {category.viewerCount !== undefined && category.viewerCount > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {formatViewerCount(category.viewerCount)} viewers
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
});

CategoryCard.displayName = "CategoryCard";
