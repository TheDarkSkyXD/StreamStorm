import { UnifiedStream } from '@/backend/api/unified/platform-types';
import { StreamCard } from './stream-card';
import { StreamCardSkeleton } from './stream-card-skeleton';
import { cn } from '@/lib/utils';
import { getStreamElementKey } from '@/lib/id-utils';

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
            <div className="flex flex-col items-center justify-center p-12 text-[var(--color-foreground-muted)] animate-fade-in-up">
                <div className="text-4xl mb-4">📺</div>
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
            "stagger-container", // CSS-based stagger animation
            className
        )}>
            {streams.map((stream) => (
                <StreamCard key={getStreamElementKey(stream)} stream={stream} />
            ))}
        </div>
    );
}
