import { UnifiedCategory } from '@/backend/api/unified/platform-types';
import { CategoryCard } from './category-card';
import { CategoryCardSkeleton } from './category-card-skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CategoryGridProps {
    categories?: UnifiedCategory[];
    isLoading?: boolean;
    emptyMessage?: string;
    className?: string;
    skeletons?: number;
}

export function CategoryGrid({
    categories,
    isLoading = false,
    emptyMessage = "No categories found",
    className,
    skeletons = 12
}: CategoryGridProps) {
    if (isLoading) {
        return (
            <div className={cn("grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4", className)}>
                {Array.from({ length: skeletons }).map((_, i) => (
                    <CategoryCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!categories || categories.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-12 text-center text-[var(--color-foreground-muted)]"
            >
                <div className="text-4xl mb-4">🎮</div>
                <p className="text-lg">{emptyMessage}</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={{
                hidden: { opacity: 0 },
                show: {
                    opacity: 1,
                    transition: {
                        staggerChildren: 0.03
                    }
                }
            }}
            initial="hidden"
            animate="show"
            className={cn("grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4", className)}
        >
            {categories.map((category) => (
                <motion.div
                    key={`${category.platform}-${category.id}`}
                    variants={{
                        hidden: { opacity: 0, scale: 0.9 },
                        show: { opacity: 1, scale: 1 }
                    }}
                >
                    <CategoryCard category={category} />
                </motion.div>
            ))}
        </motion.div>
    );
}
