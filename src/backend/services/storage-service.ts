/**
 * Storage Service
 *
 * Provides secure, persistent storage for authentication tokens,
 * user preferences, and local follows using electron-store.
 *
 * Uses Electron's safeStorage API to encrypt sensitive data like tokens.
 */

import { safeStorage } from 'electron';
import Store from 'electron-store';

import {
    StorageSchema,
    Platform,
    AuthToken,
    EncryptedToken,
    LocalFollow,
    UserPreferences,
    TwitchUser,
    KickUser,
    DEFAULT_USER_PREFERENCES,
    DEFAULT_WINDOW_BOUNDS,
} from '../../shared/auth-types';

// ========== Default Values ==========

const defaults: StorageSchema = {
    authTokens: {},
    twitchUser: null,
    kickUser: null,
    localFollows: [],
    preferences: DEFAULT_USER_PREFERENCES,
    lastActiveTab: 'home',
    windowBounds: DEFAULT_WINDOW_BOUNDS,
};

// ========== Storage Service Class ==========

class StorageService {
    private store: Store<StorageSchema>;
    private isEncryptionAvailable: boolean;

    constructor() {
        this.store = new Store<StorageSchema>({
            name: 'streamstorm-storage',
            defaults,
        });

        // Check if safeStorage encryption is available
        this.isEncryptionAvailable = safeStorage.isEncryptionAvailable();
        console.log(
            `🔐 Storage service initialized. Encryption available: ${this.isEncryptionAvailable}`
        );
    }

    // ========== Token Management ==========

    /**
     * Encrypt a token string using Electron's safeStorage
     */
    private encryptToken(token: string): EncryptedToken {
        if (!this.isEncryptionAvailable) {
            // Fallback: Store as base64 (less secure, but works in dev)
            console.warn('⚠️ safeStorage not available, using base64 fallback');
            return { encrypted: Buffer.from(token).toString('base64') };
        }

        const encrypted = safeStorage.encryptString(token);
        return { encrypted: encrypted.toString('base64') };
    }

    /**
     * Decrypt an encrypted token
     */
    private decryptToken(encryptedToken: EncryptedToken): string {
        const buffer = Buffer.from(encryptedToken.encrypted, 'base64');

        if (!this.isEncryptionAvailable) {
            // Fallback: Decode from base64
            return buffer.toString('utf8');
        }

        return safeStorage.decryptString(buffer);
    }

    /**
     * Save an auth token for a platform
     */
    saveToken(platform: Platform, token: AuthToken): void {
        const tokenString = JSON.stringify(token);
        const encrypted = this.encryptToken(tokenString);

        const tokens = this.store.get('authTokens') || {};
        tokens[platform] = encrypted;
        this.store.set('authTokens', tokens);

        console.log(`✅ Token saved for ${platform}`);
    }

    /**
     * Get an auth token for a platform
     */
    getToken(platform: Platform): AuthToken | null {
        const tokens = this.store.get('authTokens') || {};
        const encrypted = tokens[platform];

        if (!encrypted) {
            return null;
        }

        try {
            const tokenString = this.decryptToken(encrypted);
            return JSON.parse(tokenString) as AuthToken;
        } catch (error) {
            console.error(`Failed to decrypt token for ${platform}:`, error);
            return null;
        }
    }

    /**
     * Check if a token exists for a platform
     */
    hasToken(platform: Platform): boolean {
        const tokens = this.store.get('authTokens') || {};
        return !!tokens[platform];
    }

    /**
     * Check if a token is expired
     */
    isTokenExpired(platform: Platform): boolean {
        const token = this.getToken(platform);
        // If there's no token, consider it expired
        if (!token) {
            return true;
        }
        // If there's no expiresAt, assume the token is still valid
        // (it will fail when used if actually expired, and we'll refresh then)
        if (!token.expiresAt) {
            return false;
        }
        // Consider expired if less than 5 minutes remaining
        return Date.now() > token.expiresAt - 5 * 60 * 1000;
    }

    /**
     * Clear token for a platform
     */
    clearToken(platform: Platform): void {
        const tokens = this.store.get('authTokens') || {};
        delete tokens[platform];
        this.store.set('authTokens', tokens);
        console.log(`🗑️ Token cleared for ${platform}`);
    }

    /**
     * Clear all tokens
     */
    clearAllTokens(): void {
        this.store.set('authTokens', {});
        console.log('🗑️ All tokens cleared');
    }

    // ========== User Management ==========

    /**
     * Save Twitch user data
     */
    saveTwitchUser(user: TwitchUser): void {
        this.store.set('twitchUser', user);
    }

    /**
     * Get Twitch user data
     */
    getTwitchUser(): TwitchUser | null {
        return this.store.get('twitchUser') || null;
    }

    /**
     * Clear Twitch user data
     */
    clearTwitchUser(): void {
        this.store.set('twitchUser', null);
    }

    /**
     * Save Kick user data
     */
    saveKickUser(user: KickUser): void {
        this.store.set('kickUser', user);
    }

    /**
     * Get Kick user data
     */
    getKickUser(): KickUser | null {
        return this.store.get('kickUser') || null;
    }

    /**
     * Clear Kick user data
     */
    clearKickUser(): void {
        this.store.set('kickUser', null);
    }

    // ========== Local Follows Management ==========

    /**
     * Get all local follows
     */
    getLocalFollows(): LocalFollow[] {
        return this.store.get('localFollows') || [];
    }

    /**
     * Get local follows for a specific platform
     */
    getLocalFollowsByPlatform(platform: Platform): LocalFollow[] {
        return this.getLocalFollows().filter((f) => f.platform === platform);
    }

    /**
     * Add a local follow
     */
    addLocalFollow(follow: Omit<LocalFollow, 'id' | 'followedAt'>): LocalFollow {
        const newFollow: LocalFollow = {
            ...follow,
            id: `${follow.platform}-${follow.channelId}-${Date.now()}`,
            followedAt: new Date().toISOString(),
        };

        const follows = this.getLocalFollows();

        // Check if already following
        const exists = follows.some(
            (f) => f.platform === follow.platform && f.channelId === follow.channelId
        );

        if (!exists) {
            follows.push(newFollow);
            this.store.set('localFollows', follows);
            console.log(`➕ Added local follow: ${follow.displayName}`);
        }

        return newFollow;
    }

    /**
     * Remove a local follow
     */
    removeLocalFollow(id: string): boolean {
        const follows = this.getLocalFollows();
        const filtered = follows.filter((f) => f.id !== id);

        if (filtered.length < follows.length) {
            this.store.set('localFollows', filtered);
            console.log(`➖ Removed local follow: ${id}`);
            return true;
        }
        return false;
    }

    /**
     * Update a local follow
     */
    updateLocalFollow(id: string, updates: Partial<LocalFollow>): LocalFollow | null {
        const follows = this.getLocalFollows();
        const index = follows.findIndex((f) => f.id === id);

        if (index === -1) {
            return null;
        }

        follows[index] = { ...follows[index], ...updates };
        this.store.set('localFollows', follows);
        return follows[index];
    }

    /**
     * Check if following a channel
     */
    isFollowing(platform: Platform, channelId: string): boolean {
        return this.getLocalFollows().some(
            (f) => f.platform === platform && f.channelId === channelId
        );
    }

    /**
     * Import follows (merge with existing)
     */
    importLocalFollows(follows: LocalFollow[]): number {
        const existing = this.getLocalFollows();
        const existingIds = new Set(existing.map((f) => `${f.platform}-${f.channelId}`));

        const newFollows = follows.filter(
            (f) => !existingIds.has(`${f.platform}-${f.channelId}`)
        );

        if (newFollows.length > 0) {
            this.store.set('localFollows', [...existing, ...newFollows]);
        }

        console.log(`📥 Imported ${newFollows.length} new follows`);
        return newFollows.length;
    }

    /**
     * Clear all local follows
     */
    clearLocalFollows(): void {
        this.store.set('localFollows', []);
        console.log('🗑️ All local follows cleared');
    }

    // ========== Preferences Management ==========

    /**
     * Get all preferences
     */
    getPreferences(): UserPreferences {
        return this.store.get('preferences') || DEFAULT_USER_PREFERENCES;
    }

    /**
     * Update preferences (partial update)
     */
    updatePreferences(updates: Partial<UserPreferences>): UserPreferences {
        const current = this.getPreferences();
        const updated = { ...current, ...updates };
        this.store.set('preferences', updated);
        return updated;
    }

    /**
     * Reset preferences to defaults
     */
    resetPreferences(): void {
        this.store.set('preferences', DEFAULT_USER_PREFERENCES);
    }

    // ========== Window State Management ==========

    /**
     * Get window bounds
     */
    getWindowBounds(): StorageSchema['windowBounds'] {
        return this.store.get('windowBounds') || DEFAULT_WINDOW_BOUNDS;
    }

    /**
     * Save window bounds
     */
    saveWindowBounds(bounds: StorageSchema['windowBounds']): void {
        this.store.set('windowBounds', bounds);
    }

    // ========== Generic Storage ==========

    /**
     * Get a value from storage
     */
    get<K extends keyof StorageSchema>(key: K): StorageSchema[K] {
        return this.store.get(key);
    }

    /**
     * Set a value in storage
     */
    set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
        this.store.set(key, value);
    }

    /**
     * Delete a value from storage
     */
    delete<K extends keyof StorageSchema>(key: K): void {
        this.store.delete(key);
    }

    /**
     * Clear all storage
     */
    clearAll(): void {
        this.store.clear();
        console.log('🗑️ All storage cleared');
    }

    /**
     * Get storage file path (for debugging)
     */
    getStorePath(): string {
        return this.store.path;
    }
}

// ========== Export Singleton ==========

export const storageService = new StorageService();
