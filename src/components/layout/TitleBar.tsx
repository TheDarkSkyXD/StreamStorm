/**
 * Custom Title Bar Component
 * 
 * A frameless window title bar with app branding, navigation, and window controls.
 */

import React from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { useWindowControls } from '@/hooks';
import { cn } from '@/lib/utils';

interface TitleBarProps {
  className?: string;
}

export function TitleBar({ className }: TitleBarProps) {
  const { isMaximized, minimize, maximize, close } = useWindowControls();
  const isMac = navigator.platform.toLowerCase().includes('mac');

  return (
    <div
      className={cn(
        'h-10 flex items-center justify-between bg-[var(--color-background-secondary)] border-b border-[var(--color-border)] select-none',
        className
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side - Logo/Title */}
      <div className="flex items-center gap-2 px-4">
        {/* Spacer for macOS traffic lights */}
        {isMac && <div className="w-16" />}
        <span className="text-sm font-semibold bg-gradient-to-r from-[var(--color-storm-primary)] to-[var(--color-storm-secondary)] bg-clip-text text-transparent">
          🌩️ StreamStorm
        </span>
      </div>

      {/* Right side - Window controls (Windows/Linux only) */}
      {!isMac && (
        <div
          className="flex h-full"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <WindowButton onClick={minimize} aria-label="Minimize">
            <Minus size={14} />
          </WindowButton>
          <WindowButton onClick={maximize} aria-label={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? <Copy size={12} className="rotate-180" /> : <Square size={12} />}
          </WindowButton>
          <WindowButton onClick={close} isClose aria-label="Close">
            <X size={16} />
          </WindowButton>
        </div>
      )}
    </div>
  );
}

interface WindowButtonProps {
  onClick: () => void;
  isClose?: boolean;
  children: React.ReactNode;
  'aria-label': string;
}

function WindowButton({ onClick, isClose, children, 'aria-label': ariaLabel }: WindowButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'w-12 h-full flex items-center justify-center transition-colors',
        'text-[var(--color-foreground-secondary)] hover:text-[var(--color-foreground)]',
        isClose
          ? 'hover:bg-red-500 hover:text-white'
          : 'hover:bg-[var(--color-background-tertiary)]'
      )}
    >
      {children}
    </button>
  );
}
