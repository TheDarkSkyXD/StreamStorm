import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClipCard } from '@/components/stream/related-content/ClipCard';
import { VideoOrClip } from '@/components/stream/related-content/types';

// Mock dependencies
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, className }: any) => <a href={to} className={className}>{children}</a>
}));

vi.mock('@/components/ui/card', () => ({
    Card: ({ children, className }: any) => <div className={className}>{children}</div>,
    CardContent: ({ children, className }: any) => <div className={className}>{children}</div>
}));

vi.mock('@/components/ui/proxied-image', () => ({
    ProxiedImage: ({ src, alt }: any) => <img src={src} alt={alt} />
}));

vi.mock('@/components/ui/platform-avatar', () => ({
    PlatformAvatar: ({ alt }: any) => <div>{alt}</div>
}));

describe('ClipCard', () => {
    const mockClip: VideoOrClip = {
        id: '123',
        title: 'Test Clip',
        thumbnailUrl: 'thumb.jpg',
        duration: '30s',
        views: '1000',
        date: '2023-01-01',
        created_at: '2023-01-01',
        gameName: 'Test Game',
        channelName: 'TestChannel'
    };

    const mockOnClick = vi.fn();

    it('should render clip details correctly', () => {
        render(
            <ClipCard
                clip={mockClip}
                onClick={mockOnClick}
                platform="twitch"
                channelName="TestChannel"
                channelData={null}
            />
        );

        expect(screen.getByText('Test Clip')).toBeInTheDocument();
        expect(screen.getByText('30s')).toBeInTheDocument();
        expect(screen.getByText(/1K.*views/)).toBeInTheDocument();
        expect(screen.getByText('Test Game')).toBeInTheDocument();
    });

    it('should trigger onClick when clicked', () => {
        render(
            <ClipCard
                clip={mockClip}
                onClick={mockOnClick}
                platform="twitch"
                channelName="TestChannel"
                channelData={null}
            />
        );

        // Click the title
        fireEvent.click(screen.getByText('Test Clip'));
        expect(mockOnClick).toHaveBeenCalled();
    });
});
