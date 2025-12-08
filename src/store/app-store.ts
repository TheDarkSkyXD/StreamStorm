import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Application-wide UI state
 */
interface AppState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: AppState['theme']) => void;

  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Multi-stream
  activeStreams: string[];
  addStream: (streamId: string) => void;
  removeStream: (streamId: string) => void;
  clearStreams: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      // Sidebar
      sidebarOpen: true,
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Multi-stream
      activeStreams: [],
      addStream: (streamId) =>
        set((state) => ({
          activeStreams: state.activeStreams.includes(streamId)
            ? state.activeStreams
            : [...state.activeStreams, streamId].slice(0, 6), // Max 6 streams
        })),
      removeStream: (streamId) =>
        set((state) => ({
          activeStreams: state.activeStreams.filter((id) => id !== streamId),
        })),
      clearStreams: () => set({ activeStreams: [] }),
    }),
    {
      name: 'streamstorm-app-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
