
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { ProxiedImage } from '@/components/ui/proxied-image';
import { UnifiedCategory } from '@/backend/api/unified/platform-types';
import { formatViewerCount } from '@/lib/utils';

interface CategoryCardProps {
    category: UnifiedCategory;
}

export function CategoryCard({ category }: CategoryCardProps) {
    return (
        <Link
            to="/categories/$platform/$categoryId"
            params={{
                platform: category.platform,
                categoryId: category.id
            }}
            className="block h-full"
        >
            <Card className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-white transition-all h-full group bg-[var(--color-background-secondary)] border-transparent">
                <div className="aspect-[3/4] bg-[var(--color-background-tertiary)] relative overflow-hidden">
                    <ProxiedImage
                        src={category.boxArtUrl.replace('{width}', '285').replace('{height}', '380')}
                        alt={category.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        fallback={<div className="w-full h-full flex items-center justify-center text-4xl">🎮</div>}
                    />
                </div>
                <CardContent className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors" title={category.name}>
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
}
