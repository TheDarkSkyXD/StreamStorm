import React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Home, Heart, Grid3X3, Search, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { TitleBar } from './TitleBar';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/following', label: 'Following', icon: Heart },
  { path: '/categories', label: 'Categories', icon: Grid3X3 },
  { path: '/search', label: 'Search', icon: Search },
  { path: '/settings', label: 'Settings', icon: Settings },
] as const;

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const location = useLocation();

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Custom Title Bar */}
      <TitleBar />
      
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'flex flex-col border-r border-[var(--color-border)] bg-[var(--color-background-secondary)] transition-all duration-200',
            sidebarCollapsed ? 'w-16' : 'w-56'
          )}
        >
          {/* Navigation */}
          <nav className="flex-1 py-4">
            <ul className="space-y-1 px-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                        isActive
                          ? 'bg-[var(--color-storm-primary)] text-white'
                          : 'text-[var(--color-foreground-secondary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-foreground)]'
                      )}
                    >
                      <Icon size={20} />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Collapse Toggle */}
          <div className="p-2 border-t border-[var(--color-border)]">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[var(--color-foreground-secondary)] hover:bg-[var(--color-background-tertiary)] transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
