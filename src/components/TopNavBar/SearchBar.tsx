import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
    className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate({ to: '/search', search: { q: searchQuery } });
        }
    };

    const handleClear = () => {
        setSearchQuery('');
        inputRef.current?.focus();
    };

    return (
        <div className={cn("relative w-full max-w-xl", className)}>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white pointer-events-none">
                    <Search size={16} />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search streams, channels, categories..."
                    className="w-full h-9 pl-10 pr-10 rounded-full bg-[var(--color-background-secondary)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-muted)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                />

                {searchQuery && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:opacity-80 transition-opacity"
                        title="Clear search"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}
