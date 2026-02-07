import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";

import { VirtualizedCategoryGrid } from "@/components/discovery/virtualized-category-grid";
import { useTopCategories } from "@/hooks/queries/useCategories";

// Initial categories to display, then load more on scroll
const INITIAL_DISPLAY_COUNT = 30;
const LOAD_MORE_COUNT = 10;
const DISPLAY_COUNT_KEY = "categories-display-count";

export function CategoriesPage() {
  // Fetch ALL categories (cached, deduped with Twitch priority)
  const { data: categories, isLoading } = useTopCategories();
  const [searchQuery, setSearchQuery] = useState("");

  // Restore displayCount from sessionStorage for scroll position persistence
  const [displayCount, setDisplayCount] = useState(() => {
    const saved = sessionStorage.getItem(DISPLAY_COUNT_KEY);
    return saved ? Math.max(INITIAL_DISPLAY_COUNT, parseInt(saved, 10)) : INITIAL_DISPLAY_COUNT;
  });

  // Save displayCount to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem(DISPLAY_COUNT_KEY, String(displayCount));
  }, [displayCount]);

  // Memoize filtered results for performance
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories || [];
    const query = searchQuery.toLowerCase();
    return categories?.filter((category) => category.name.toLowerCase().includes(query)) || [];
  }, [categories, searchQuery]);

  // Progressive display: show only displayCount categories
  const displayedCategories = useMemo(() => {
    return filteredCategories.slice(0, displayCount);
  }, [filteredCategories, displayCount]);

  // Check if there are more categories to load
  const hasNextPage = displayCount < filteredCategories.length;

  // Load more handler
  const handleLoadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + LOAD_MORE_COUNT, filteredCategories.length));
  }, [filteredCategories.length]);

  // Reset display count when search query changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, []);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Categories</h1>
          <p className="text-[var(--color-foreground-secondary)]">
            {categories?.length
              ? `${categories.length} categories from Twitch & Kick`
              : "Browse streams by game or category"}
          </p>
        </div>

        <div className="relative w-full max-w-sm">
          <LuSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]"
            size={16}
          />
          <input
            type="text"
            placeholder="Filter categories..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--color-background-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="mt-2 flex-1 min-h-0">
        <VirtualizedCategoryGrid
          categories={displayedCategories}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          onLoadMore={handleLoadMore}
          skeletonCount={7}
          scrollKey="categories-page"
          emptyMessage={
            searchQuery ? `No categories matching "${searchQuery}"` : "No categories found"
          }
        />
      </div>
    </div>
  );
}
