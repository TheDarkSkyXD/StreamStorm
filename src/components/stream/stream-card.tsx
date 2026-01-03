import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { ProxiedImage } from '@/components/ui/proxied-image';
import { KickIcon, TwitchIcon } from '@/components/icons/PlatformIcons';
import { UnifiedStream } from '@/backend/api/unified/platform-types';
import { cn, formatViewerCount } from '@/lib/utils';
import { PlatformAvatar } from '@/components/ui/platform-avatar';

interface StreamCardProps {
    stream: UnifiedStream;
    showCategory?: boolean;
}

export function StreamCard({ stream, showCategory = true }: StreamCardProps) {
    const PlatformIcon = stream.platform === 'twitch' ? TwitchIcon : KickIcon;
    const platformColor = stream.platform === 'twitch' ? 'text-[#9146FF]' : 'text-[#53FC18]';

    return (
        <Link
            to="/stream/$platform/$channel"
            params={{ platform: stream.platform, channel: stream.channelName }}
            search={{ tab: 'videos' }}
            className="block group"
        >
            <Card className="h-full border-transparent bg-transparent hover:bg-[var(--color-background-secondary)] transition-colors duration-200 overflow-hidden group-hover:ring-1 group-hover:ring-[var(--color-border)]">
                {/* Thumbnail Section */}
                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                    <ProxiedImage
                        src={stream.thumbnailUrl}
                        alt={stream.title}
                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                        fallback={<div className="w-full h-full bg-[var(--color-background-tertiary)] flex items-center justify-center text-[var(--color-foreground-muted)]">No Thumbnail</div>}
                    />



                    {/* Live Badge */}
                    {stream.isLive && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            Live
                        </div>
                    )}

                    {/* Viewer Count */}
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-medium backdrop-blur-sm">
                        {formatViewerCount(stream.viewerCount)} viewers
                    </div>

                    {/* Platform Badge */}
                    <div className={`absolute top-2 right-2 p-1 rounded bg-black/80 ${platformColor} backdrop-blur-sm`}>
                        <PlatformIcon size={14} />
                    </div>
                </div>

                {/* Info Section */}
                <CardContent className="p-3 pt-3 flex gap-3">
                    {/* Avatar */}
                    <div className="shrink-0">
                        <PlatformAvatar
                            src={stream.channelAvatar}
                            alt={stream.channelDisplayName}
                            platform={stream.platform}
                            size="w-10 h-10"
                            showBadge={true}
                        />
                    </div>

                    {/* Text Content */}
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <h3 className="font-bold text-sm text-[var(--color-foreground)] truncate leading-tight group-hover:text-[var(--color-primary)] transition-colors">
                            {stream.title}
                        </h3>
                        {showCategory && stream.categoryName && (
                            <div className="text-xs font-bold text-[var(--color-foreground)] truncate hover:underline mt-1">
                                {stream.categoryName}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-sm font-bold text-[#b5b5b5] truncate leading-none">
                                {stream.channelDisplayName}
                            </span>
                        </div>
                        {/* Tags */}
                        {(() => {
                            // Prepare tags list
                            const displayTags: string[] = [];

                            // Add language tag first if valid
                            if (stream.language) {
                                const langName = new Intl.DisplayNames(['en'], { type: 'language' }).of(stream.language) || stream.language;
                                displayTags.push(langName);
                            }

                            // Add other tags, filtering out duplicates (case-insensitive check against language)
                            if (stream.tags && stream.tags.length > 0) {
                                const langLower = stream.language?.toLowerCase();
                                const langNameLower = displayTags[0]?.toLowerCase();
                                stream.tags.forEach(tag => {
                                    // Don't add if it's the same as the language code or name
                                    if (tag.toLowerCase() !== langLower && tag.toLowerCase() !== langNameLower) {
                                        displayTags.push(tag);
                                    }
                                });
                            }

                            if (displayTags.length === 0) return null;

                            // Calculate limit based on length
                            // Heuristic: Check length of first 3 tags
                            let totalChars = 0;
                            const checkCount = Math.min(displayTags.length, 3);
                            for (let i = 0; i < checkCount; i++) {
                                totalChars += displayTags[i].length;
                            }

                            // If tags are "long" (avg > 8 chars or total > 24), limit to 3. Else 4.
                            const maxTags = totalChars > 24 ? 3 : 4;
                            const finalTags = displayTags.slice(0, maxTags);

                            return (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {finalTags.map((tag, index) => (
                                        <span
                                            key={`${tag}-${index}`}
                                            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#35373C] text-white hover:bg-[#464950] transition-colors whitespace-nowrap"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}


