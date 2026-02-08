import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContentTabs } from '@/components/stream/related-content/ContentTabs';

// Mock Link
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, className, search }: any) => (
        <a className={className} data-tab={search?.tab}>
            {children}
        </a>
    )
}));

describe('ContentTabs', () => {
    it('should render both tabs', () => {
        render(<ContentTabs activeTab="videos" />);
        expect(screen.getByText('Videos')).toBeInTheDocument();
        expect(screen.getByText('Clips')).toBeInTheDocument();
    });

    it('should highlight videos tab when active', () => {
        render(<ContentTabs activeTab="videos" />);
        const videosLink = screen.getByText('Videos').closest('a');
        expect(videosLink).toHaveClass('text-[var(--color-foreground)]');
    });

    it('should highlight clips tab when active', () => {
        render(<ContentTabs activeTab="clips" />);
        const clipsLink = screen.getByText('Clips').closest('a');
        expect(clipsLink).toHaveClass('text-[var(--color-foreground)]');
    });
});
