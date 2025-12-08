import React from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { X, Search, User, Grid, Clock, ArrowUpLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearchChannels, useSearchCategories } from '@/hooks/queries/useSearch';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import type { UnifiedChannel, UnifiedCategory } from '@/backend/api/unified/platform-types';

interface SearchBarProps {
    className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isFocused, setIsFocused] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const { history, addSearch, removeSearch } = useSearchHistory();
    const debouncedQuery = useDebounce(searchQuery, 300);

    // Only fetch suggestions if query is > 0 chars
    const shouldFetch = debouncedQuery.length > 0;
    const { data: channels, isLoading: channelsLoading } = useSearchChannels(debouncedQuery, undefined, 6); // Limit 6
    const { data: categories, isLoading: categoriesLoading } = useSearchCategories(debouncedQuery, undefined, 4); // Limit 4

    // Filter history based on query (simple fuzzy match)
    const filteredHistory = React.useMemo(() => {
        if (!searchQuery) return history;
        const normalizedQuery = searchQuery.toLowerCase();
        return history.filter(item =>
            item.toLowerCase().includes(normalizedQuery)
        );
    }, [searchQuery, history]);

    // Split channels into exact matches and others
    const { topMatches, otherMatches } = React.useMemo(() => {
        if (!channels || !searchQuery) return { topMatches: [], otherMatches: [] };

        const normalizedQuery = searchQuery.toLowerCase().trim();
        const top: UnifiedChannel[] = [];
        const others: UnifiedChannel[] = [];

        channels.forEach(channel => {
            const username = channel.username?.toLowerCase() || '';
            const displayName = channel.displayName?.toLowerCase() || '';

            // Check for exact match on username or display name
            const isExact = username === normalizedQuery || displayName === normalizedQuery;

            if (isExact) {
                top.push(channel);
            } else {
                others.push(channel);
            }
        });

        return { topMatches: top, otherMatches: others };
    }, [channels, searchQuery]);

    // Hide suggestions when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const executeSearch = (term: string) => {
        if (!term.trim()) return;
        addSearch(term);
        navigate({ to: '/search', search: { q: term } });
        setIsFocused(false);
        setSearchQuery(term);
        inputRef.current?.blur();
    };

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            executeSearch(searchQuery);
        }
    };

    const handleClear = () => {
        if (searchQuery.trim()) {
            addSearch(searchQuery);
        }
        setSearchQuery('');
        inputRef.current?.focus();
    };

    const hasResults = shouldFetch && ((channels?.length || 0) > 0 || (categories?.length || 0) > 0);
    const showHistory = isFocused && !searchQuery && history.length > 0;
    const showSuggestions = isFocused && searchQuery.length > 0 && (hasResults || channelsLoading || categoriesLoading);

    // We show the dropdown if we have history to show OR if we have suggestions
    const showDropdown = showHistory || showSuggestions;

    return (
        <div ref={containerRef} className={cn("relative w-full max-w-xl z-50", className)}>
            <div className="relative">
                <div className={cn("absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors", isFocused ? "text-white" : "text-[var(--color-foreground-muted)]")}>
                    <Search size={16} />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search streams, channels, categories..."
                    className={cn(
                        "w-full h-9 pl-10 pr-10 rounded-full bg-[var(--color-background-secondary)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-muted)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white transition-all"
                    )}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    onFocus={() => setIsFocused(true)}
                // Prevent suggestions from being hidden immediately when clicking items
                />

                {searchQuery && (
                    <button
                        onClick={handleClear}
                        className={cn("absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-white", isFocused ? "text-white" : "text-[var(--color-foreground-muted)]")}
                        title="Clear search"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0F0F12] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200 flex flex-col max-h-[80vh] overflow-y-auto">

                    {/* SEARCH HISTORY */}
                    {showHistory && (
                        <div className="py-2">
                            {filteredHistory.map((term) => (
                                <div
                                    key={term}
                                    className="flex items-center justify-between px-4 py-2 hover:bg-[var(--color-background-secondary)] transition-colors group cursor-pointer"
                                    onClick={() => executeSearch(term)}
                                >
                                    <div className="flex items-center gap-3 text-white/50 group-hover:text-white transition-colors">
                                        <Clock size={18} className="text-white/50 group-hover:text-white transition-colors" />
                                        <span className="font-bold text-sm text-white">{term}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeSearch(term);
                                            }}
                                            className="p-1 text-white hover:text-red-500 transition-colors"
                                            title="Remove from history"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* BEST MATCHES */}
                    {topMatches.length > 0 && (
                        <div className={cn("py-2", showHistory && "border-t border-[var(--color-border)]")}>
                            <h3 className="px-4 py-1.5 text-xs font-bold text-[var(--color-storm-primary)] uppercase tracking-wider flex items-center gap-2">
                                <Sparkles size={12} /> Best Match
                            </h3>
                            {topMatches.map((channel: UnifiedChannel) => (
                                <Link
                                    key={channel.id}
                                    to="/stream/$platform/$channel"
                                    params={{ platform: channel.platform, channel: channel.username }}
                                    search={{ tab: 'videos' }}
                                    onClick={() => {
                                        addSearch(channel.displayName);
                                        setIsFocused(false);
                                        setSearchQuery('');
                                    }}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--color-background-secondary)] transition-colors group bg-[var(--color-background-secondary)]/30 border-l-2 border-[var(--color-storm-primary)] mx-2 rounded-r-md"
                                >
                                    <div className="relative">
                                        {channel.avatarUrl ? (
                                            <img src={channel.avatarUrl} alt={channel.displayName} className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--color-storm-primary)]/20" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                                                <span className="text-xs font-bold text-white uppercase">{channel.displayName.slice(0, 1)}</span>
                                            </div>
                                        )}
                                        {channel.isLive && (
                                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0F0F12]" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-base text-[var(--color-foreground)] group-hover:text-[var(--color-storm-primary)] truncate">
                                            {channel.displayName}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
                                            <span className="capitalize font-medium text-[var(--color-storm-primary)]">{channel.platform}</span>
                                            {channel.isLive && <span className="text-red-500 font-bold">• LIVE</span>}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* OTHER CHANNELS SUGGESTIONS */}
                    {otherMatches.length > 0 && (
                        <div className={cn("py-2", (showHistory || topMatches.length > 0) && "border-t border-[var(--color-border)]")}>
                            <h3 className="px-4 py-1.5 text-xs font-bold text-[var(--color-foreground-muted)] uppercase tracking-wider flex items-center gap-2">
                                <User size={12} /> Channels
                            </h3>
                            {otherMatches.map((channel: UnifiedChannel) => (
                                <Link
                                    key={channel.id}
                                    to="/stream/$platform/$channel"
                                    params={{ platform: channel.platform, channel: channel.username }}
                                    search={{ tab: 'videos' }}
                                    onClick={() => {
                                        addSearch(channel.displayName);
                                        setIsFocused(false);
                                        setSearchQuery('');
                                    }}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--color-background-secondary)] transition-colors group"
                                >
                                    <div className="relative">
                                        {channel.avatarUrl ? (
                                            <img src={channel.avatarUrl} alt={channel.displayName} className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                                                <span className="text-xs font-bold text-white uppercase">{channel.displayName.slice(0, 1)}</span>
                                            </div>
                                        )}
                                        {channel.isLive && (
                                            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0F0F12]" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-[var(--color-foreground)] group-hover:text-[var(--color-storm-primary)] truncate">
                                            {channel.displayName}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
                                            <span className="capitalize">{channel.platform}</span>
                                            {channel.isLive && <span className="text-red-500 font-bold">• LIVE</span>}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* CATEGORIES SUGGESTIONS */}
                    {categories && categories.length > 0 && (
                        <div className={cn("py-2 border-t border-[var(--color-border)]")}>
                            <h3 className="px-4 py-1.5 text-xs font-bold text-[var(--color-foreground-muted)] uppercase tracking-wider flex items-center gap-2">
                                <Grid size={12} /> Categories
                            </h3>
                            {categories.map((category: UnifiedCategory) => (
                                <Link
                                    key={category.id}
                                    to="/categories/$platform/$categoryId"
                                    params={{ platform: category.platform, categoryId: category.id }}
                                    onClick={() => {
                                        addSearch(category.name);
                                        setIsFocused(false);
                                        setSearchQuery('');
                                    }}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--color-background-secondary)] transition-colors group"
                                >
                                    {category.boxArtUrl ? (
                                        <img src={category.boxArtUrl} alt={category.name} className="w-6 h-8 rounded object-cover" />
                                    ) : (
                                        <div className="w-6 h-8 rounded bg-zinc-700 flex items-center justify-center">
                                            <Grid size={14} className="text-white/50" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-[var(--color-foreground)] group-hover:text-[var(--color-storm-primary)] truncate">
                                            {category.name}
                                        </p>
                                        <p className="text-xs text-[var(--color-foreground-muted)] capitalize">
                                            {category.platform}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {searchQuery.length > 0 && (
                        <div className="p-2 border-t border-[var(--color-border)] bg-[var(--color-background-secondary)]/50">
                            <button
                                onClick={() => executeSearch(searchQuery)}
                                className="w-full py-2 text-sm font-bold text-[var(--color-storm-primary)] hover:underline flex items-center justify-center gap-1"
                            >
                                <Search size={14} />
                                See all results for "{searchQuery}"
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
