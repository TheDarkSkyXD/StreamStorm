import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import { ChatMessage, ChatConnectionStatus, ChatPlatform } from '../shared/chat-types';

/**
 * Performance-optimized Chat Store
 * 
 * Key optimizations (inspired by KickTalk-main):
 * 1. Dynamic message limits (200 normal, 600 when paused)
 * 2. Duplicate message prevention via ID check
 * 3. Efficient slice-based trimming from the front
 * 4. Message batching support for high-volume chats
 */

// Message limits - lower limits = less RAM usage
// Reduced from 200/600 to fix 5GB RAM spikes
const MESSAGE_LIMIT_NORMAL = 150;
const MESSAGE_LIMIT_PAUSED = 400;

// Force trim when this many messages over limit (avoids frequent small trims)
const TRIM_BUFFER = 25;

// Batching configuration
interface MessageBatch {
    queue: ChatMessage[];
    timer: ReturnType<typeof setTimeout> | null;
}

// Global batching state (outside React lifecycle for persistence)
const messageBatches: Record<string, MessageBatch> = {};

interface ChatState {
    messages: ChatMessage[];
    connectionStatus: Record<ChatPlatform, ChatConnectionStatus>;
    isPaused: boolean;

    // Batching settings
    batchingEnabled: boolean;
    batchingInterval: number; // ms

    // Actions
    addMessage: (message: ChatMessage) => void;
    addMessageBatched: (message: ChatMessage, channelKey: string) => void;
    flushBatch: (channelKey: string) => void;
    clearMessages: (platform?: ChatPlatform) => void;
    deleteMessage: (messageId: string) => void;
    deleteMessagesByUser: (userId: string) => void;
    updateConnectionStatus: (status: ChatConnectionStatus) => void;
    setPaused: (paused: boolean) => void;
    setBatchingEnabled: (enabled: boolean) => void;
    setBatchingInterval: (interval: number) => void;
    cleanupBatching: () => void;
}

export const useChatStore = create<ChatState>()(
    subscribeWithSelector((set, get) => ({
        messages: [],
        isPaused: false,
        batchingEnabled: false,
        batchingInterval: 50, // Default 50ms batch interval
        connectionStatus: {
            twitch: {
                platform: 'twitch',
                state: 'disconnected',
                channels: [],
                isAuthenticated: false
            },
            kick: {
                platform: 'kick',
                state: 'disconnected',
                channels: [],
                isAuthenticated: false
            }
        },

        addMessage: (message) => set((state) => {
            const currentMessages = state.messages;

            // Duplicate prevention - check last 50 messages only (optimization)
            const recentMessages = currentMessages.slice(-50);
            if (recentMessages.some(m => m.id === message.id)) {
                return state;
            }

            // Dynamic limit based on pause state
            const maxMessages = state.isPaused ? MESSAGE_LIMIT_PAUSED : MESSAGE_LIMIT_NORMAL;

            // Only trim when significantly over limit (reduces allocation frequency)
            const needsTrim = currentMessages.length >= maxMessages + TRIM_BUFFER;

            if (needsTrim) {
                // Trim more aggressively - remove TRIM_BUFFER + 1 messages at once
                const trimmedMessages = currentMessages.slice(-(maxMessages - TRIM_BUFFER));
                return { messages: [...trimmedMessages, message] };
            }

            // Normal append - mutate-in-place style for better performance
            return { messages: [...currentMessages, message] };
        }),

        // Batched message adding for high-volume chats
        addMessageBatched: (message, channelKey) => {
            const state = get();

            // If batching disabled, add immediately
            if (!state.batchingEnabled || state.batchingInterval === 0) {
                state.addMessage(message);
                return;
            }

            // Initialize batch for channel if needed
            if (!messageBatches[channelKey]) {
                messageBatches[channelKey] = {
                    queue: [],
                    timer: null,
                };
            }

            const batch = messageBatches[channelKey];
            batch.queue.push(message);

            // Set up flush timer if not already running
            if (!batch.timer) {
                batch.timer = setTimeout(() => {
                    get().flushBatch(channelKey);
                }, state.batchingInterval);
            }
        },

        flushBatch: (channelKey) => {
            const batch = messageBatches[channelKey];
            if (!batch) return;

            const messages = batch.queue;
            if (messages.length > 0) {
                // Add all batched messages at once
                set((state) => {
                    const currentMessages = state.messages;
                    const maxMessages = state.isPaused ? MESSAGE_LIMIT_PAUSED : MESSAGE_LIMIT_NORMAL;

                    // Filter out duplicates
                    const existingIds = new Set(currentMessages.map(m => m.id));
                    const newMessages = messages.filter(m => !existingIds.has(m.id));

                    let updatedMessages = [...currentMessages, ...newMessages];

                    // Trim if over limit
                    if (updatedMessages.length > maxMessages) {
                        updatedMessages = updatedMessages.slice(-maxMessages);
                    }

                    return { messages: updatedMessages };
                });
            }

            // Reset batch
            batch.queue = [];
            batch.timer = null;
        },

        cleanupBatching: () => {
            // Cleanup all batches (call on unmount)
            Object.keys(messageBatches).forEach(channelKey => {
                const batch = messageBatches[channelKey];
                if (batch.timer) {
                    clearTimeout(batch.timer);
                }
                // Flush remaining messages
                if (batch.queue.length > 0) {
                    get().flushBatch(channelKey);
                }
            });
            // Clear global batches
            Object.keys(messageBatches).forEach(key => delete messageBatches[key]);
        },

        clearMessages: (platform) => set((state) => {
            if (platform) {
                return { messages: state.messages.filter(m => m.platform !== platform) };
            }
            return { messages: [] };
        }),

        deleteMessage: (messageId) => set((state) => ({
            messages: state.messages.map(m =>
                m.id === messageId ? { ...m, isDeleted: true } : m
            )
        })),

        deleteMessagesByUser: (userId) => set((state) => ({
            messages: state.messages.map(m =>
                m.userId === userId ? { ...m, isDeleted: true } : m
            )
        })),

        updateConnectionStatus: (status) => set((state) => ({
            connectionStatus: {
                ...state.connectionStatus,
                [status.platform]: status
            }
        })),

        setPaused: (paused) => set({ isPaused: paused }),
        setBatchingEnabled: (enabled) => set({ batchingEnabled: enabled }),
        setBatchingInterval: (interval) => set({ batchingInterval: interval }),
    }))
);
