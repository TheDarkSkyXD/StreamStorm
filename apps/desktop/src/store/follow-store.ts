import { create } from "zustand";

import type { UnifiedChannel } from "../backend/api/unified/platform-types";
import { channelMatchesKey, getChannelKey } from "../lib/id-utils";

interface FollowState {
  localFollows: UnifiedChannel[];
  followChannel: (channel: UnifiedChannel) => void;
  unfollowChannel: (channelKey: string) => void;
  isFollowing: (channelKey: string) => boolean;
  toggleFollow: (channel: UnifiedChannel) => void;
  hydrate: () => Promise<void>;
}

export const useFollowStore = create<FollowState>()((set, get) => ({
  localFollows: [],
  followChannel: async (channel) => {
    const currentFollows = get().localFollows;
    const channelKey = getChannelKey(channel);

    // Check if already following using platform-aware key
    if (currentFollows.some((c) => getChannelKey(c) === channelKey)) return;

    // Optimistic update
    set({ localFollows: [...currentFollows, channel] });

    try {
      // Sync to backend
      await window.electronAPI.follows.add({
        platform: channel.platform as "twitch" | "kick",
        channelId: channel.id,
        channelName: channel.username,
        displayName: channel.displayName,
        profileImage: channel.avatarUrl,
      });
    } catch (err) {
      console.error("Failed to save follow to backend:", err);
      // Rollback on error
      set({ localFollows: currentFollows });
    }
  },
  unfollowChannel: async (channelKey) => {
    const currentFollows = get().localFollows;

    // Find channel using flexible matching (supports both new and legacy keys)
    const followToRemove = currentFollows.find((c) => channelMatchesKey(c, channelKey));
    if (!followToRemove) {
      console.warn(`[FollowStore] No channel found matching key: ${channelKey}`);
      return;
    }

    // Remove optimistically using platform-aware comparison
    const updatedFollows = currentFollows.filter(
      (c) => getChannelKey(c) !== getChannelKey(followToRemove)
    );
    set({ localFollows: updatedFollows });

    // Sync to backend
    try {
      const backendFollows = await window.electronAPI.follows.getAll();
      // Match by platform AND channelId for precision
      const match = backendFollows.find(
        (f) => f.platform === followToRemove.platform && f.channelId === followToRemove.id
      );

      if (match) {
        await window.electronAPI.follows.remove(match.id);
      }
    } catch (err) {
      console.error("Failed to remove follow from backend:", err);
      // Rollback
      set({ localFollows: currentFollows });
    }
  },
  isFollowing: (channelKey) => {
    const follows = get().localFollows;
    // Use flexible matching that supports both platform-aware keys and legacy formats
    return follows.some((c) => channelMatchesKey(c, channelKey));
  },
  toggleFollow: (channel) => {
    const { isFollowing, followChannel, unfollowChannel } = get();
    // Use platform-aware key for checking and unfollowing
    const channelKey = getChannelKey(channel);
    if (isFollowing(channelKey)) {
      unfollowChannel(channelKey);
    } else {
      followChannel(channel);
    }
  },

  // Initializer to load from backend
  hydrate: async () => {
    try {
      const follows = await window.electronAPI.follows.getAll();
      // Map LocalFollow -> UnifiedChannel
      const channels: UnifiedChannel[] = follows.map((f) => ({
        id: f.channelId,
        platform: f.platform,
        username: f.channelName,
        displayName: f.displayName,
        avatarUrl: f.profileImage,
        bannerUrl: "", // Not stored locally
        bio: "", // Not stored locally
        isLive: false, // will be updated by other hooks
        isVerified: false,
        isPartner: false,
      }));
      set({ localFollows: channels });
    } catch (e) {
      console.error("Failed to load local follows:", e);
    }
  },
}));
