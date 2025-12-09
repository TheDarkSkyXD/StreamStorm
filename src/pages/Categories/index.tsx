import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTopCategories } from '@/hooks/queries/useCategories';
import { CategoryGrid } from '@/components/discovery/category-grid';

export function CategoriesPage() {
  const { data: categories, isLoading } = useTopCategories(undefined, 100);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = categories?.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Categories</h1>
          <p className="text-[var(--color-foreground-secondary)]">
            Browse streams by game or category
          </p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]" size={16} />
          <input
            type="text"
            placeholder="Filter categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--color-background-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
          />
        </div>
      </div>

      <CategoryGrid
        categories={filteredCategories}
        isLoading={isLoading}
        emptyMessage={`No categories found matching "${searchQuery}"`}
      />
    </div>
  );
}
