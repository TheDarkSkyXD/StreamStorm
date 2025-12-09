import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UnifiedSearchInput } from '@/components/search/UnifiedSearchInput';

interface SearchBarProps {
    className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
    const navigate = useNavigate();

    return (
        <UnifiedSearchInput
            className={className}
            onSearch={(term) => navigate({ to: '/search', search: { q: term } })}
            placeholder="Search streams, channels, categories..."
        />
    );
}
