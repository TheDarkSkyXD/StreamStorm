
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Platform } from '@/shared/auth-types';

export interface MultiStreamConfig {
    id: string;
    platform: Platform;
    channelName: string;
    isMuted: boolean;
    volume: number;
}

export type LayoutMode = 'grid' | 'focus';


interface MultiStreamState {
    // Streams
    streams: MultiStreamConfig[];
    addStream: (platform: Platform, channelName: string) => void;
    removeStream: (streamId: string) => void;
    updateStream: (streamId: string, updates: Partial<MultiStreamConfig>) => void;
    reorderStreams: (startIndex: number, endIndex: number) => void;
    clearStreams: () => void;

    // Layout
    layout: LayoutMode;
    focusedStreamId: string | null;
    setLayout: (layout: LayoutMode) => void;
    setFocusedStream: (streamId: string | null) => void;

    // Chat
    isChatOpen: boolean;
    chatStreamId: string | null;
    toggleChat: () => void;
    setChatStream: (streamId: string | null) => void;

    // Audio
    toggleMute: (streamId: string) => void;
    setVolume: (streamId: string, volume: number) => void;
}

export const useMultiStreamStore = create<MultiStreamState>()(
    persist(
        (set, _get) => ({
            streams: [],
            layout: 'grid',
            focusedStreamId: null,
            isChatOpen: true,
            chatStreamId: null,

            addStream: (platform, channelName) => set((state) => {
                if (state.streams.length >= 6) return state; // Max 6 streams
                const id = `${platform}-${channelName}`;
                if (state.streams.some(s => s.id === id)) return state; // No duplicates

                const newStream: MultiStreamConfig = {
                    id,
                    platform,
                    channelName,
                    isMuted: state.streams.length > 0, // Auto-mute subsequent streams
                    volume: 0.5,
                };

                return {
                    streams: [...state.streams, newStream],
                    chatStreamId: state.chatStreamId || id // Set chat if none selected
                };
            }),

            removeStream: (streamId) => set((state) => {
                const newStreams = state.streams.filter(s => s.id !== streamId);
                return {
                    streams: newStreams,
                    // specialized logic to update focused stream and chat stream if removed
                    focusedStreamId: state.focusedStreamId === streamId ? null : state.focusedStreamId,
                    chatStreamId: state.chatStreamId === streamId
                        ? (newStreams.length > 0 ? newStreams[0].id : null)
                        : state.chatStreamId
                };
            }),

            updateStream: (streamId, updates) => set((state) => ({
                streams: state.streams.map(s => s.id === streamId ? { ...s, ...updates } : s)
            })),

            reorderStreams: (startIndex, endIndex) => set((state) => {
                const result = Array.from(state.streams);
                const [removed] = result.splice(startIndex, 1);
                result.splice(endIndex, 0, removed);
                return { streams: result };
            }),

            clearStreams: () => set({ streams: [], chatStreamId: null, focusedStreamId: null }),

            setLayout: (layout) => set({ layout }),
            setFocusedStream: (focusedStreamId) => set({ focusedStreamId, layout: focusedStreamId ? 'focus' : 'grid' }),

            toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
            setChatStream: (chatStreamId) => set({ chatStreamId }),

            toggleMute: (streamId) => set((state) => ({
                streams: state.streams.map(s => s.id === streamId ? { ...s, isMuted: !s.isMuted } : s)
            })),

            setVolume: (streamId, volume) => set((state) => ({
                streams: state.streams.map(s => s.id === streamId ? { ...s, volume } : s)
            })),

        }),
        {
            name: 'multistream-storage',
            partialize: (state) => ({
                streams: state.streams,
                layout: 'grid',
                isChatOpen: state.isChatOpen,
            }),
        }
    )
);
