
import { Download, CheckCircle, FileVideo, AlertCircle, PauseCircle, PlayCircle } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface DownloadItem {
    id: string;
    title: string;
    thumbnail?: string;
    size: string;
    progress: number;
    status: 'downloading' | 'completed' | 'paused' | 'error';
    speed?: string;
    timeLeft?: string;
    type: 'video' | 'clip';
}

// Placeholder data as requested
const MOCK_DOWNLOADS: DownloadItem[] = [
    {
        id: '1',
        title: 'Epic Win Moment #32',
        size: '45.2 MB',
        progress: 100,
        status: 'completed',
        type: 'clip',
        thumbnail: 'https://placehold.co/320x180/1a1a1a/cccccc?text=Clip'
    },
    {
        id: '2',
        title: 'Full Stream VOD - 2024-03-15',
        size: '2.4 GB',
        progress: 45,
        status: 'downloading',
        speed: '12.5 MB/s',
        timeLeft: '2 mins remaining',
        type: 'video',
        thumbnail: 'https://placehold.co/320x180/1a1a1a/cccccc?text=VOD'
    },
    {
        id: '3',
        title: 'Funny Fail Compilation',
        size: '128 MB',
        progress: 8,
        status: 'paused',
        type: 'video',
        thumbnail: 'https://placehold.co/320x180/1a1a1a/cccccc?text=Video'
    }
];

export function DownloadsPage() {
    const activeDownloads = MOCK_DOWNLOADS.filter(d => d.status !== 'completed');
    const completedDownloads = MOCK_DOWNLOADS.filter(d => d.status === 'completed');

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-3 mb-6">
                <Download className="w-8 h-8 text-[var(--color-primary)]" />
                <h1 className="text-3xl font-bold">Downloads</h1>
            </div>

            {/* Active Downloads Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    Active Downloads
                    <span className="text-sm font-normal text-[var(--color-foreground-secondary)] bg-[var(--color-background-secondary)] px-2 py-0.5 rounded-full">
                        {activeDownloads.length}
                    </span>
                </h2>

                {activeDownloads.length === 0 ? (
                    <div className="text-[var(--color-foreground-secondary)] italic">No active downloads.</div>
                ) : (
                    <div className="space-y-3">
                        {activeDownloads.map((item) => (
                            <div
                                key={item.id}
                                className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-4 flex gap-4 items-center"
                            >
                                {/* Thumbnail */}
                                <div className="w-24 h-14 bg-black/40 rounded overflow-hidden flex-shrink-0 relative">
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <FileVideo className="w-full h-full p-3 text-[var(--color-foreground-secondary)]" />
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        {item.type === 'clip' ? '🎬' : '📹'}
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between mb-1">
                                        <h3 className="font-medium truncate pr-4">{item.title}</h3>
                                        <div className="text-xs text-[var(--color-foreground-secondary)] font-mono whitespace-nowrap">
                                            {item.status === 'downloading' ? (
                                                <>
                                                    <span className="text-[var(--color-primary)]">{item.speed}</span> • {item.timeLeft}
                                                </>
                                            ) : (
                                                <span className="uppercase">{item.status}</span>
                                            )}
                                        </div>
                                    </div>

                                    <Progress value={item.progress} className="h-2" />

                                    <div className="flex justify-between mt-1 text-xs text-[var(--color-foreground-secondary)]">
                                        <span>{item.size}</span>
                                        <span>{item.progress}%</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    {item.status === 'downloading' ? (
                                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-zinc-800">
                                            <PauseCircle className="w-5 h-5" />
                                        </Button>
                                    ) : (
                                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-zinc-800">
                                            <PlayCircle className="w-5 h-5" />
                                        </Button>
                                    )}
                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-500 hover:bg-zinc-800">
                                        <AlertCircle className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Completed Downloads Section */}
            <section className="space-y-4 pt-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    Completed
                    <span className="text-sm font-normal text-[var(--color-foreground-secondary)] bg-[var(--color-background-secondary)] px-2 py-0.5 rounded-full">
                        {completedDownloads.length}
                    </span>
                </h2>

                {completedDownloads.length === 0 ? (
                    <div className="text-[var(--color-foreground-secondary)] italic">No completed downloads.</div>
                ) : (
                    <div className="space-y-3">
                        {completedDownloads.map((item) => (
                            <div
                                key={item.id}
                                className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-4 flex gap-4 items-center opacity-80 hover:opacity-100 transition-opacity"
                            >
                                {/* Thumbnail */}
                                <div className="w-24 h-14 bg-black/40 rounded overflow-hidden flex-shrink-0">
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <FileVideo className="w-full h-full p-3 text-[var(--color-foreground-secondary)]" />
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium truncate">{item.title}</h3>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-foreground-secondary)]">
                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                        <span>Download Complete</span>
                                        <span>•</span>
                                        <span>{item.size}</span>
                                        <span>•</span>
                                        <span className="capitalize">{item.type}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="hidden sm:flex">Show in Folder</Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-zinc-800">
                                        <PlayCircle className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
