import { UnifiedStream } from '@/backend/api/unified/platform-types';
import { StreamCard } from './stream-card';
import { StreamCardSkeleton } from './stream-card-skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StreamGridProps {
    streams?: UnifiedStream[];
    isLoading?: boolean;
    emptyMessage?: string;
    className?: string;
    skeletons?: number;
}

export function StreamGrid({
    streams,
    isLoading = false,
    emptyMessage = "No streams found",
    className,
    skeletons = 8
}: StreamGridProps) {
    if (isLoading) {
        return (
            <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", className)}>
                {Array.from({ length: skeletons }).map((_, i) => (
                    <StreamCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!streams || streams.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center p-12 text-[var(--color-foreground-muted)]"
            >
                <div className="text-4xl mb-4">📺</div>
                <p>{emptyMessage}</p>
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
                        staggerChildren: 0.05
                    }
                }
            }}
            initial="hidden"
            animate="show"
            className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", className)}
        >
            {streams.map((stream) => (
                <motion.div
                    key={`${stream.platform}-${stream.id}`}
                    variants={{
                        hidden: { opacity: 0, y: 20 },
                        show: { opacity: 1, y: 0 }
                    }}
                >
                    <StreamCard stream={stream} />
                </motion.div>
            ))}
        </motion.div>
    );
}
