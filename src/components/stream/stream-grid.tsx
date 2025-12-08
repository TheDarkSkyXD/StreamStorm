import { UnifiedStream } from '@/backend/api/unified/platform-types';
import { StreamCard } from './stream-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
                    <div key={i} className="space-y-3">
                        <Skeleton className="aspect-video w-full rounded-lg" />
                        <div className="flex gap-3 px-1">
                            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!streams || streams.length === 0) {
        return (
            <div className="flex items-center justify-center p-12 text-[var(--color-foreground-muted)]">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", className)}>
            {streams.map((stream) => (
                <StreamCard key={`${stream.platform}-${stream.id}`} stream={stream} />
            ))}
        </div>
    );
}
