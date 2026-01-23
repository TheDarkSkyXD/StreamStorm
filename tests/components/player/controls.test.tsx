import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayPauseButton } from '@/components/player/play-pause-button';
import { VolumeControl } from '@/components/player/volume-control';
import { QualitySelector } from '@/components/player/quality-selector';
import { QualityLevel } from '@/components/player/types';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('Player Controls', () => {
    describe('PlayPauseButton', () => {
        it('should render play icon when paused', () => {
            const { container } = render(
                <TooltipProvider>
                    <PlayPauseButton isPlaying={false} onToggle={vi.fn()} />
                </TooltipProvider>
            );
            expect(container.querySelector('.lucide-play')).toBeInTheDocument();
        });

        it('should render pause icon when playing', () => {
            const { container } = render(
                <TooltipProvider>
                    <PlayPauseButton isPlaying={true} onToggle={vi.fn()} />
                </TooltipProvider>
            );
            expect(container.querySelector('.lucide-pause')).toBeInTheDocument();
        });

        it('should call onToggle when clicked', () => {
            const onToggle = vi.fn();
            render(
                <TooltipProvider>
                    <PlayPauseButton isPlaying={false} onToggle={onToggle} />
                </TooltipProvider>
            );
            fireEvent.click(screen.getByRole('button'));
            expect(onToggle).toHaveBeenCalled();
        });
    });

    describe('VolumeControl', () => {
        it('should render volume level correctly (high)', () => {
            const { container } = render(
                <TooltipProvider>
                    <VolumeControl volume={80} muted={false} onVolumeChange={vi.fn()} onMuteToggle={vi.fn()} />
                </TooltipProvider>
            );
            expect(container.querySelector('.lucide-volume-2')).toBeInTheDocument();
        });

        it('should render muted state', () => {
            const { container } = render(
                <TooltipProvider>
                    <VolumeControl volume={80} muted={true} onVolumeChange={vi.fn()} onMuteToggle={vi.fn()} />
                </TooltipProvider>
            );
            expect(container.querySelector('.lucide-volume-x')).toBeInTheDocument();
        });

        it('should call onMuteToggle when button clicked', () => {
            const onMuteToggle = vi.fn();
            render(
                <TooltipProvider>
                    <VolumeControl volume={50} muted={false} onVolumeChange={vi.fn()} onMuteToggle={onMuteToggle} />
                </TooltipProvider>
            );
            fireEvent.click(screen.getByRole('button'));
            expect(onMuteToggle).toHaveBeenCalled();
        });
    });

    describe('QualitySelector', () => {
        const qualities: QualityLevel[] = [
            { id: 'auto', label: 'Auto', bitrate: 0, isAuto: true },
            { id: '1080p', label: '1080p', bitrate: 6000000 }
        ] as any; // Cast to any to avoid strict type checking for width/height if redundant for this test

        it('should not render if no levels', () => {
            const { container } = render(<QualitySelector levels={[]} current="auto" onChange={vi.fn()} />);
            expect(container).toBeEmptyDOMElement();
        });

        it('should render selected value', () => {
            render(<QualitySelector levels={qualities} current="auto" onChange={vi.fn()} />);
            expect(screen.getByText('Auto')).toBeInTheDocument();
        });
    });
});
