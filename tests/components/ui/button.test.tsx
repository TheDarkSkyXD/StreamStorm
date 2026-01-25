import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button', () => {
    it('should render children', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('should apply variant classes', () => {
        const { container } = render(<Button variant="destructive">Delete</Button>);
        expect(container.firstChild).toHaveClass('bg-red-500');
    });

    it('should apply size classes', () => {
        const { container } = render(<Button size="sm">Small</Button>);
        expect(container.firstChild).toHaveClass('h-9');
    });

    it('should be disabled when disabled prop is true', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should handle click events', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click</Button>);
        fireEvent.click(screen.getByRole('button'));
        expect(handleClick).toHaveBeenCalled();
    });
});
