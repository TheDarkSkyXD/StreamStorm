import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UnifiedChannel } from '../backend/api/unified/platform-types';

interface FollowState {
    localFollows: UnifiedChannel[];
    followChannel: (channel: UnifiedChannel) => void;
    unfollowChannel: (channelId: string) => void;
    isFollowing: (channelId: string) => boolean;
    toggleFollow: (channel: UnifiedChannel) => void;
    hydrate: () => Promise<void>;
}

export const useFollowStore = create<FollowState>()(
    (set, get) => ({
        localFollows: [],
        followChannel: async (channel) => {
            const currentFollows = get().localFollows;
            if (currentFollows.some(c => c.id === channel.id)) return;

            // Optimistic update
            set({ localFollows: [...currentFollows, channel] });

            try {
                // Sync to backend
                await window.electronAPI.follows.add({
                    platform: channel.platform as 'twitch' | 'kick',
                    channelId: channel.id,
                    channelName: channel.username,
                    displayName: channel.displayName,
                    profileImage: channel.avatarUrl,
                });
            } catch (err) {
                console.error('Failed to save follow to backend:', err);
                // Rollback on error
                set({ localFollows: currentFollows });
            }
        },
        unfollowChannel: async (channelId) => {
            const currentFollows = get().localFollows;
            const followToRemove = currentFollows.find(c => c.id === channelId);

            // Remove optimistic
            set({ localFollows: currentFollows.filter(c => c.id !== channelId) });

            // Sync to backend
            // Note: remove assumes we have the unique Follow ID, but here we likely only have Channel ID
            // We need to find the correct local (guest) follow ID to remove it from the backend list
            // Or the backend 'remove' could accept platform+channelId? 
            // The backend 'remove' currently expects the 'follow.id' (e.g. "platform-channelId-timestamp").

            // Let's fetch the actual stored follows to find the ID to delete?
            // Or simpler: Update backend `follows.remove` to handle Logic by ChannelId, or we try to reconstruct it.
            // But we don't have the timestamp.
            // STRATEGY: 
            // 1. Fetch backend list first? No, slow.
            // 2. We should store the full LocalFollow object including its backend ID in this store?
            //    Currently we store `UnifiedChannel`. We're losing the `LocalFollow.id`.

            // FIX: We need to find the ID. 
            // For now, let's assumme we can find it by channel ID in our sync logic?
            // The `ipc-handlers` for `FOLLOWS_REMOVE` expects the ID.

            // Workaround: We'll retrieve the list from backend to find the ID matching this channel.
            try {
                const backendFollows = await window.electronAPI.follows.getAll();
                const match = backendFollows.find(f => f.channelId === channelId || `${f.platform}-${f.channelId}` === channelId); // channelId in store might be just the ID

                if (match) {
                    await window.electronAPI.follows.remove(match.id);
                }
            } catch (err) {
                console.error('Failed to remove follow from backend:', err);
                // Rollback
                set({ localFollows: currentFollows });
            }
        },
        isFollowing: (channelId) => {
            const follows = get().localFollows;
            return follows.some((c) =>
                c.id === channelId ||
                c.username === channelId ||
                c.username?.toLowerCase() === channelId?.toLowerCase() ||
                `${c.platform}-${c.username}` === channelId ||
                `${c.platform}-${c.username?.toLowerCase()}` === channelId?.toLowerCase()
            );
        },
        toggleFollow: (channel) => {
            const { isFollowing, followChannel, unfollowChannel } = get();
            if (isFollowing(channel.id)) {
                unfollowChannel(channel.id);
            } else {
                followChannel(channel);
            }
        },

        // Initializer to load from backend
        hydrate: async () => {
            try {
                const follows = await window.electronAPI.follows.getAll();
                // Map LocalFollow -> UnifiedChannel
                const channels: UnifiedChannel[] = follows.map(f => ({
                    id: f.channelId,
                    platform: f.platform,
                    username: f.channelName,
                    displayName: f.displayName,
                    avatarUrl: f.profileImage,
                    bannerUrl: '', // Not stored locally
                    bio: '',       // Not stored locally
                    isLive: false, // will be updated by other hooks
                    isVerified: false,
                    isPartner: false
                }));
                set({ localFollows: channels });
            } catch (e) {
                console.error('Failed to load local follows:', e);
            }
        }
    })
);
