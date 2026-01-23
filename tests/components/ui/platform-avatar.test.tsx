import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlatformAvatar } from '@/components/ui/platform-avatar';

// Mock ProxiedImage
vi.mock('@/components/ui/proxied-image', () => ({
    ProxiedImage: ({ fallback, alt, className }: any) => (
        <div data-testid="proxied-image" className={className}>
            {alt}
            {fallback}
        </div>
    )
}));

describe('PlatformAvatar', () => {
    it('should render with correct platform colors for Twitch', () => {
        const { container } = render(
            <PlatformAvatar platform="twitch" alt="TwitchUser" />
        );
        // Look for the background color class in the wrapper div inside the root
        // The structure is: div.relative > div.bg-[#9146FF] > ProxiedImage
        expect(container.querySelector('.bg-\\[\\#9146FF\\]')).toBeInTheDocument();
    });

    it('should render with correct platform colors for Kick', () => {
        const { container } = render(
            <PlatformAvatar platform="kick" alt="KickUser" />
        );
        expect(container.querySelector('.bg-\\[\\#53FC18\\]')).toBeInTheDocument();
    });

    it('should show LIVE badge when isLive is true with badge type', () => {
        render(
            <PlatformAvatar platform="twitch" alt="TwitchUser" isLive={true} liveStatusType="badge" />
        );
        expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    it('should show red dot when isLive is true with dot type', () => {
        const { container } = render(
            <PlatformAvatar platform="twitch" alt="TwitchUser" isLive={true} liveStatusType="dot" />
        );
        expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    });
});
