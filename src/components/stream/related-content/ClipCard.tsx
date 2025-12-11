import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Play } from 'lucide-react';
import { VideoOrClip } from './types';
import { formatTimeAgo, formatViews } from './utils';

interface ClipCardProps {
    clip: VideoOrClip;
    onClick: () => void;
}

export function ClipCard({ clip, onClick }: ClipCardProps) {
    return (
        <div
            onClick={onClick}
            className="block group cursor-pointer"
        >
            <Card className="overflow-hidden hover:border-white transition-colors h-full border border-transparent bg-[var(--color-background-secondary)]">
                <div className="aspect-video bg-[var(--color-background-tertiary)] relative">
                    {clip.thumbnailUrl && (
                        <img src={clip.thumbnailUrl} alt={clip.title} className="absolute inset-0 w-full h-full object-cover" />
                    )}

                    {/* Duration: Top Left */}
                    <div className="absolute top-2 left-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                        {clip.duration}
                    </div>

                    {/* Views: Bottom Left */}
                    <div className="absolute bottom-2 left-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                        {formatViews(clip.views)} views
                    </div>

                    {/* Date: Bottom Right */}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-medium">
                        {formatTimeAgo(clip.date)}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                    </div>
                </div>
                <CardContent className="pt-3">
                    <h3 className="font-medium text-sm line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors text-white">
                        {clip.title}
                    </h3>
                </CardContent>
            </Card>
        </div>
    );
}
