
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';
import { app } from 'electron';

export class DatabaseService {
    private db: Database.Database;

    constructor() {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'streamstorm.db');

        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        console.debug(`📂 Initializing SQLite database at: ${dbPath}`);

        this.db = new Database(dbPath); // verbose: console.log for debug?
        this.errCheck();

        this.init();
    }

    private errCheck() {
        // Enable WAL mode for better concurrency/performance
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
    }

    private init() {
        // 1. Key-Value Store (replacing electron-store for prefs/tokens)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS key_value (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);

        // 2. Local Follows (The high-volume table)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS local_follows (
                id TEXT PRIMARY KEY,
                platform TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                channel_name TEXT NOT NULL,
                display_name TEXT,
                profile_image TEXT,
                followed_at TEXT,
                UNIQUE(platform, channel_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_follows_platform ON local_follows(platform);
            CREATE INDEX IF NOT EXISTS idx_follows_channel_id ON local_follows(channel_id);
        `);

        console.debug('✅ SQLite Schema initialized');
    }

    // ========== Key-Value Operations ==========

    get<T>(key: string): T | null {
        const stmt = this.db.prepare('SELECT value FROM key_value WHERE key = ?');
        const row = stmt.get(key) as { value: string } | undefined;
        if (!row) return null;
        try {
            return JSON.parse(row.value) as T;
        } catch {
            return null;
        }
    }

    set(key: string, value: any): void {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO key_value (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
    }

    delete(key: string): void {
        const stmt = this.db.prepare('DELETE FROM key_value WHERE key = ?');
        stmt.run(key);
    }

    clearKeyValue(): void {
        this.db.exec('DELETE FROM key_value');
    }

    // ========== Local Follows Operations ==========

    getAllFollows(): any[] {
        const stmt = this.db.prepare('SELECT * FROM local_follows ORDER BY followed_at DESC');
        return stmt.all().map(this.mapFollowFromDb);
    }

    getFollowsByPlatform(platform: string): any[] {
        const stmt = this.db.prepare('SELECT * FROM local_follows WHERE platform = ? ORDER BY followed_at DESC');
        return stmt.all(platform).map(this.mapFollowFromDb);
    }

    addFollow(follow: any): any {
        // Assuming follow object matches structure but keys might be camelCase
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO local_follows (id, platform, channel_id, channel_name, display_name, profile_image, followed_at)
            VALUES (@id, @platform, @channelId, @channelName, @displayName, @profileImage, @followedAt)
        `);

        // Ensure ID exists
        if (!follow.id) {
            follow.id = `${follow.platform}-${follow.channelId}-${Date.now()}`;
        }
        if (!follow.followedAt) {
            follow.followedAt = new Date().toISOString();
        }

        stmt.run({
            id: follow.id,
            platform: follow.platform,
            channelId: follow.channelId,
            channelName: follow.channelName || follow.username, // Handle varying input?
            displayName: follow.displayName,
            profileImage: follow.profileImage || follow.avatarUrl,
            followedAt: follow.followedAt
        });

        return follow;
    }

    removeFollow(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM local_follows WHERE id = ?');
        const info = stmt.run(id);
        return info.changes > 0;
    }

    isFollowing(platform: string, channelId: string): boolean {
        const stmt = this.db.prepare('SELECT 1 FROM local_follows WHERE platform = ? AND channel_id = ? LIMIT 1');
        return !!stmt.get(platform, channelId);
    }

    clearFollows(): void {
        this.db.exec('DELETE FROM local_follows');
    }

    // Helper to map snake_case DB columns to camelCase JS objects if needed
    // However, I used map directly. Let's ensure types match.
    private mapFollowFromDb(row: any): any {
        return {
            id: row.id,
            platform: row.platform,
            channelId: row.channel_id,
            channelName: row.channel_name,
            displayName: row.display_name,
            profileImage: row.profile_image,
            followedAt: row.followed_at
        };
    }
}

export const dbService = new DatabaseService();
