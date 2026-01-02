/**
 * Custom Title Bar Component
 * 
 * A frameless window title bar with app branding and window controls.
 * Keep this minimal - user info is in TopNavBar.
 */

import { Minus, Square, X, Copy } from 'lucide-react';
import React from 'react';

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
        'h-8 flex items-center justify-between bg-[var(--color-background-secondary)] border-b border-[var(--color-border)] select-none',
        className
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side - Logo/Title */}
      <div className="flex items-center gap-2 px-4">
        {/* Spacer for macOS traffic lights */}
        {isMac && <div className="w-16" />}
        <span className="text-xs font-semibold text-[var(--color-foreground)]">
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
            <Minus size={20} />
          </WindowButton>
          <WindowButton onClick={maximize} aria-label={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? <Copy size={18} className="rotate-180" /> : <Square size={18} />}
          </WindowButton>
          <WindowButton onClick={close} isClose aria-label="Close">
            <X size={20} />
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
        'w-12 h-full flex items-center justify-center transition-colors focus:outline-none',
        'text-white',
        isClose
          ? 'hover:bg-red-500 hover:text-white'
          : 'hover:bg-[var(--color-background-tertiary)]'
      )}
    >
      {children}
    </button>
  );
}
