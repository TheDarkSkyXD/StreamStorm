import React from 'react';
import { Link } from '@tanstack/react-router';
import { Play, Clapperboard } from 'lucide-react';

interface ContentTabsProps {
    activeTab: string | undefined;
}

export function ContentTabs({ activeTab }: ContentTabsProps) {
    return (
        <div className="flex items-center gap-4 border-b border-[var(--color-border)]">
            <Link
                from="/stream/$platform/$channel"
                search={{ tab: 'videos' }}
                className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'videos'
                    ? 'text-[var(--color-foreground)]'
                    : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]'
                    }`}
            >
                <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Videos</span>
                {activeTab === 'videos' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
            </Link>
            <Link
                from="/stream/$platform/$channel"
                search={{ tab: 'clips' }}
                className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'clips'
                    ? 'text-[var(--color-foreground)]'
                    : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]'
                    }`}
            >
                <span className="flex items-center gap-2"><Clapperboard className="w-4 h-4" /> Clips</span>
                {activeTab === 'clips' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
            </Link>
        </div>
    );
}
