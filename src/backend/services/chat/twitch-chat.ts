/**
 * Twitch Chat Service
 *
 * Manages Twitch IRC chat connections using tmi.js.
 * Handles message receiving, sending, and connection lifecycle.
 */

import tmi from 'tmi.js';
import { EventEmitter } from 'events';

import type {
    ChatMessage,
    ChatConnectionStatus,
    ChatConnectionState,
    UserNotice,
    ClearChat,
    MessageDeletion,
    ChatServiceEvents,
} from '../../../shared/chat-types';
import { getOAuthConfig } from '../../auth/oauth-config';
import { storageService } from '../storage-service';

import { badgeResolver } from './badge-resolver';
import { parseTwitchMessage, type TwitchTags } from './twitch-parser';

// ========== Types ==========

interface TwitchChatOptions {
    /** Connect anonymously (read-only) if true */
    anonymous?: boolean;
    /** Enable debug logging */
    debug?: boolean;
}

type TypedEventEmitter = {
    on<K extends keyof ChatServiceEvents>(event: K, listener: ChatServiceEvents[K]): void;
    off<K extends keyof ChatServiceEvents>(event: K, listener: ChatServiceEvents[K]): void;
    emit<K extends keyof ChatServiceEvents>(
        event: K,
        ...args: Parameters<ChatServiceEvents[K]>
    ): boolean;
};

// ========== Constants ==========

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MESSAGE_RATE_LIMIT = 20; // Messages per 30 seconds (normal user)
const MOD_MESSAGE_RATE_LIMIT = 100; // Messages per 30 seconds (mod/broadcaster)

// ========== TwitchChatService Class ==========

export class TwitchChatService extends EventEmitter implements TypedEventEmitter {
    private client: tmi.Client | null = null;
    private channels: Set<string> = new Set();
    private connectionState: ChatConnectionState = 'disconnected';
    private reconnectAttempts = 0;
    private isAnonymous = false;
    private debugMode = false;
    private broadcasterId: Map<string, string> = new Map(); // channel -> broadcaster ID

    // Rate limiting
    private messageTimestamps: number[] = [];
    private isModerator: Map<string, boolean> = new Map(); // channel -> isMod

    // ========== Public API ==========

    /**
     * Connect to Twitch IRC
     */
    async connect(options: TwitchChatOptions = {}): Promise<void> {
        if (this.client && this.connectionState === 'connected') {
            this.log('Already connected');
            return;
        }

        this.debugMode = options.debug ?? false;
        this.isAnonymous = options.anonymous ?? false;

        this.setConnectionState('connecting');

        try {
            // Load global badges
            await badgeResolver.loadGlobalBadges();

            // Create client
            this.client = this.createClient();

            // Set up event handlers
            this.setupEventHandlers();

            // Connect
            await this.client.connect();

            this.reconnectAttempts = 0;
            this.setConnectionState('connected');
            this.log('Connected to Twitch IRC');
        } catch (error) {
            this.handleConnectionError(error);
            throw error;
        }
    }

    /**
     * Disconnect from Twitch IRC
     */
    async disconnect(): Promise<void> {
        if (!this.client) return;

        try {
            await this.client.disconnect();
        } catch {
            // Ignore disconnect errors
        }

        this.client = null;
        this.channels.clear();
        this.setConnectionState('disconnected');
        this.log('Disconnected from Twitch IRC');
    }

    /**
     * Join a channel's chat
     */
    async joinChannel(channel: string, broadcasterId?: string): Promise<void> {
        const normalizedChannel = this.normalizeChannel(channel);

        if (this.channels.has(normalizedChannel)) {
            this.log(`Already in channel: ${normalizedChannel}`);
            return;
        }

        if (!this.client || this.connectionState !== 'connected') {
            throw new Error('Not connected to Twitch IRC');
        }

        try {
            await this.client.join(normalizedChannel);
            this.channels.add(normalizedChannel);

            // Store broadcaster ID for badge resolution
            if (broadcasterId) {
                this.broadcasterId.set(normalizedChannel, broadcasterId);
                await badgeResolver.loadChannelBadges(broadcasterId);
            }

            this.emitConnectionStatus();
            this.log(`Joined channel: ${normalizedChannel}`);
        } catch (error) {
            console.error(`Failed to join channel ${normalizedChannel}:`, error);
            throw error;
        }
    }

    /**
     * Leave a channel's chat
     */
    async leaveChannel(channel: string): Promise<void> {
        const normalizedChannel = this.normalizeChannel(channel);

        if (!this.channels.has(normalizedChannel)) {
            return;
        }

        if (!this.client) {
            this.channels.delete(normalizedChannel);
            return;
        }

        try {
            await this.client.part(normalizedChannel);
            this.channels.delete(normalizedChannel);
            this.broadcasterId.delete(normalizedChannel);
            this.isModerator.delete(normalizedChannel);
            this.emitConnectionStatus();
            this.log(`Left channel: ${normalizedChannel}`);
        } catch (error) {
            console.error(`Failed to leave channel ${normalizedChannel}:`, error);
        }
    }

    /**
     * Send a message to a channel
     */
    async sendMessage(channel: string, message: string): Promise<void> {
        if (this.isAnonymous) {
            throw new Error('Cannot send messages in anonymous mode');
        }

        if (!this.client || this.connectionState !== 'connected') {
            throw new Error('Not connected to Twitch IRC');
        }

        const normalizedChannel = this.normalizeChannel(channel);

        if (!this.channels.has(normalizedChannel)) {
            throw new Error(`Not in channel: ${normalizedChannel}`);
        }

        // Rate limiting
        if (!this.checkRateLimit(normalizedChannel)) {
            throw new Error('Message rate limit exceeded');
        }

        try {
            await this.client.say(normalizedChannel, message);
            this.recordMessageSent();
        } catch (error) {
            console.error(`Failed to send message to ${normalizedChannel}:`, error);
            throw error;
        }
    }

    /**
     * Send a /me action message
     */
    async sendAction(channel: string, message: string): Promise<void> {
        if (this.isAnonymous) {
            throw new Error('Cannot send messages in anonymous mode');
        }

        if (!this.client || this.connectionState !== 'connected') {
            throw new Error('Not connected to Twitch IRC');
        }

        const normalizedChannel = this.normalizeChannel(channel);

        if (!this.checkRateLimit(normalizedChannel)) {
            throw new Error('Message rate limit exceeded');
        }

        try {
            await this.client.action(normalizedChannel, message);
            this.recordMessageSent();
        } catch (error) {
            console.error(`Failed to send action to ${normalizedChannel}:`, error);
            throw error;
        }
    }

    /**
     * Send a reply to a message
     */
    async sendReply(channel: string, parentMessageId: string, message: string): Promise<void> {
        if (!this.client || this.connectionState !== 'connected') {
            throw new Error('Not connected to Twitch IRC');
        }

        const normalizedChannel = this.normalizeChannel(channel);

        if (!this.checkRateLimit(normalizedChannel)) {
            throw new Error('Message rate limit exceeded');
        }

        try {
            // tmi.js doesn't have native reply support, use raw command
            await this.client.raw(
                `@reply-parent-msg-id=${parentMessageId} PRIVMSG #${normalizedChannel} :${message}`
            );
            this.recordMessageSent();
        } catch (error) {
            console.error(`Failed to send reply in ${normalizedChannel}:`, error);
            throw error;
        }
    }

    /**
     * Get current connection status
     */
    getConnectionStatus(): ChatConnectionStatus {
        return {
            platform: 'twitch',
            state: this.connectionState,
            channels: Array.from(this.channels),
            isAuthenticated: !this.isAnonymous && this.connectionState === 'connected',
        };
    }

    /**
     * Check if connected to a specific channel
     */
    isInChannel(channel: string): boolean {
        return this.channels.has(this.normalizeChannel(channel));
    }

    /**
     * Check if we are a moderator in a channel
     */
    isModeratorIn(channel: string): boolean {
        return this.isModerator.get(this.normalizeChannel(channel)) ?? false;
    }

    // ========== Private Methods ==========

    /**
     * Create tmi.js client with appropriate options
     */
    private createClient(): tmi.Client {
        const config = getOAuthConfig('twitch');
        const token = storageService.getToken('twitch')?.accessToken;
        const user = storageService.getTwitchUser();

        const options: tmi.Options = {
            options: {
                debug: this.debugMode,
                skipUpdatingEmotesets: true,
            },
            connection: {
                reconnect: true,
                secure: true,
            },
        };

        // Authenticated or anonymous connection
        if (!this.isAnonymous && token && user) {
            options.identity = {
                username: user.login,
                password: `oauth:${token}`,
            };
        }

        return new tmi.Client(options);
    }

    /**
     * Set up event handlers for the tmi.js client
     */
    private setupEventHandlers(): void {
        if (!this.client) return;

        // Connection events
        this.client.on('connected', () => {
            this.setConnectionState('connected');
            this.reconnectAttempts = 0;
        });

        this.client.on('disconnected', (reason) => {
            this.log(`Disconnected: ${reason}`);
            this.handleDisconnect();
        });

        this.client.on('reconnect', () => {
            this.setConnectionState('reconnecting');
        });

        // Message events
        this.client.on('message', (channel, tags, message, self) => {
            this.handleMessage(channel, tags as TwitchTags, message, self);
        });

        this.client.on('action', (channel, tags, message, self) => {
            // Action messages are handled by the 'message' event with message-type: action
            // This is redundant but we can use it for logging
        });

        // User notice events (subs, raids, etc.)
        this.client.on('resub', (channel, username, months, message, tags, methods) => {
            this.handleUserNotice('resub', channel, tags as TwitchTags, message);
        });

        this.client.on('subscription', (channel, username, methods, message, tags) => {
            this.handleUserNotice('sub', channel, tags as TwitchTags, message);
        });

        this.client.on('subgift', (channel, username, streakMonths, recipient, methods, tags) => {
            this.handleUserNotice('subgift', channel, tags as TwitchTags, undefined);
        });

        this.client.on('raided', (channel, username, viewers) => {
            // Note: raided event doesn't provide tags, create minimal notice
            const notice: UserNotice = {
                id: crypto.randomUUID(),
                platform: 'twitch',
                channel: this.normalizeChannel(channel),
                type: 'raid',
                userId: '',
                username: username.toLowerCase(),
                displayName: username,
                message: undefined,
                systemMessage: `${username} is raiding with ${viewers} viewers!`,
                timestamp: new Date(),
                viewerCount: viewers,
            };
            this.emit('userNotice', notice);
        });

        // Moderation events
        this.client.on('clearchat', (channel) => {
            this.emit('clearChat', {
                platform: 'twitch',
                channel: this.normalizeChannel(channel),
                isClearAll: true,
                timestamp: new Date(),
            });
        });

        this.client.on('timeout', (channel, username, reason, duration, tags) => {
            const typedTags = tags as Record<string, unknown>;
            this.emit('clearChat', {
                platform: 'twitch',
                channel: this.normalizeChannel(channel),
                targetUserId: typedTags['target-user-id'] as string | undefined,
                targetUsername: username,
                duration,
                isClearAll: false,
                timestamp: new Date(),
            });
        });

        this.client.on('ban', (channel, username, reason, tags) => {
            const typedTags = tags as Record<string, unknown>;
            this.emit('clearChat', {
                platform: 'twitch',
                channel: this.normalizeChannel(channel),
                targetUserId: typedTags['target-user-id'] as string | undefined,
                targetUsername: username,
                isClearAll: false,
                timestamp: new Date(),
            });
        });

        this.client.on('messagedeleted', (channel, username, deletedMessage, tags) => {
            const typedTags = tags as Record<string, unknown>;
            this.emit('messageDeleted', {
                platform: 'twitch',
                channel: this.normalizeChannel(channel),
                messageId: (typedTags['target-msg-id'] as string) ?? '',
                timestamp: new Date(),
            });
        });

        // Mod status
        this.client.on('mod', (channel, username) => {
            const user = storageService.getTwitchUser();
            if (user && username.toLowerCase() === user.login.toLowerCase()) {
                this.isModerator.set(this.normalizeChannel(channel), true);
            }
        });

        this.client.on('unmod', (channel, username) => {
            const user = storageService.getTwitchUser();
            if (user && username.toLowerCase() === user.login.toLowerCase()) {
                this.isModerator.set(this.normalizeChannel(channel), false);
            }
        });
    }

    /**
     * Handle incoming chat message
     */
    private handleMessage(
        channel: string,
        tags: TwitchTags,
        message: string,
        self: boolean
    ): void {
        const parsedMessage = parseTwitchMessage(channel, tags, message, self);

        // Resolve badges with channel-specific ones
        const broadcasterId = this.broadcasterId.get(this.normalizeChannel(channel));
        if (broadcasterId) {
            parsedMessage.badges = badgeResolver.resolveBadges(
                parsedMessage.badges,
                broadcasterId
            );
        }

        this.emit('message', parsedMessage);
    }

    /**
     * Handle user notice events (subs, raids, etc.)
     */
    private handleUserNotice(
        type: 'sub' | 'resub' | 'subgift' | 'raid',
        channel: string,
        tags: TwitchTags,
        message: string | undefined
    ): void {
        const typedTags = tags as Record<string, unknown>;
        const notice: UserNotice = {
            id: (typedTags.id as string) ?? crypto.randomUUID(),
            platform: 'twitch',
            channel: this.normalizeChannel(channel),
            type,
            userId: (typedTags['user-id'] as string) ?? '',
            username: ((typedTags['display-name'] as string) ?? '').toLowerCase(),
            displayName: (typedTags['display-name'] as string) ?? '',
            message,
            systemMessage: (typedTags['system-msg'] as string) ?? '',
            timestamp: new Date(),
        };

        this.emit('userNotice', notice);
    }

    /**
     * Handle disconnection and attempt reconnection
     */
    private handleDisconnect(): void {
        this.setConnectionState('disconnected');

        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            this.setConnectionState('reconnecting');

            setTimeout(async () => {
                try {
                    await this.connect({ anonymous: this.isAnonymous, debug: this.debugMode });

                    // Rejoin channels
                    for (const channel of this.channels) {
                        await this.joinChannel(channel);
                    }
                } catch (error) {
                    console.error('Reconnection failed:', error);
                }
            }, RECONNECT_DELAY_MS * this.reconnectAttempts);
        } else {
            this.emit('error', new Error('Max reconnection attempts reached'));
        }
    }

    /**
     * Handle connection error
     */
    private handleConnectionError(error: unknown): void {
        console.error('Twitch chat connection error:', error);
        this.setConnectionState('disconnected');
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }

    /**
     * Update and emit connection state
     */
    private setConnectionState(state: ChatConnectionState): void {
        this.connectionState = state;
        this.emitConnectionStatus();
    }

    /**
     * Emit current connection status
     */
    private emitConnectionStatus(): void {
        this.emit('connectionStateChange', this.getConnectionStatus());
    }

    /**
     * Normalize channel name (lowercase, no #)
     */
    private normalizeChannel(channel: string): string {
        return channel.toLowerCase().replace('#', '');
    }

    /**
     * Check if we can send a message (rate limiting)
     */
    private checkRateLimit(channel: string): boolean {
        const now = Date.now();
        const thirtySecondsAgo = now - 30000;

        // Clean old timestamps
        this.messageTimestamps = this.messageTimestamps.filter((ts) => ts > thirtySecondsAgo);

        const limit = this.isModerator.get(channel)
            ? MOD_MESSAGE_RATE_LIMIT
            : MESSAGE_RATE_LIMIT;

        return this.messageTimestamps.length < limit;
    }

    /**
     * Record a sent message for rate limiting
     */
    private recordMessageSent(): void {
        this.messageTimestamps.push(Date.now());
    }

    /**
     * Log message (respects debug mode)
     */
    private log(message: string): void {
        if (this.debugMode) {
            console.debug(`[TwitchChat] ${message}`);
        }
    }
}

// ========== Export Singleton ==========

export const twitchChatService = new TwitchChatService();
