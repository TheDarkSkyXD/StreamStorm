import type React from "react";
import { useEffect, useRef, useState } from "react";
import { kickChatService } from "../../../backend/services/chat/kick-chat";
import { initializeKickEmotes } from "../../../backend/services/emotes";
import type {
  ChatConnectionStatus,
  ChatMessage,
  ClearChat,
  MessageDeletion,
  UserNotice,
} from "../../../shared/chat-types";
import { useChatStore } from "../../../store/chat-store";
import { useEmoteStore } from "../../../store/emote-store";
import { ChatInput } from "../ChatInput";
import { ChatMessageList } from "../ChatMessageList";

export interface KickChatProps {
  /** Channel name to join */
  channel: string;
  /** Chatroom ID (required for Kick) */
  chatroomId?: number;
  /** Subscriber badges for the channel (for badge rendering) */
  subscriberBadges?: any[];
}

export const KickChat: React.FC<KickChatProps> = ({ channel, chatroomId, subscriberBadges }) => {
  // Chat store
  const {
    addMessage,
    updateConnectionStatus,
    clearMessages,
    deleteMessage,
    deleteMessagesByUser,
    connectionStatus,
  } = useChatStore();

  const { loadGlobalEmotes, loadChannelEmotes, setActiveChannel, unloadChannelEmotes } =
    useEmoteStore();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Track current channel for cleanup
  // Initialize with null so we know when it's the first connection (and clear previous messages)
  const currentChannelRef = useRef<{ channel: string; chatroomId?: number } | null>(null);

  // Initial Connection & Channel Joining
  useEffect(() => {
    // Use mounted flag for cleanup with React Strict Mode
    let isMounted = true;

    const connect = async () => {
      try {
        // Check if channel changed to clear previous messages
        // This will also be true on first mount since ref starts as null
        const isChannelChanged =
          !currentChannelRef.current ||
          currentChannelRef.current.channel !== channel ||
          currentChannelRef.current.chatroomId !== chatroomId;

        if (isChannelChanged) {
          clearMessages();
          currentChannelRef.current = { channel, chatroomId };
        }

        // Acquire a reference to the service (for multiview support)
        kickChatService.acquire();

        // System message: Connecting
        addMessage({
          id: crypto.randomUUID(),
          platform: "kick",
          type: "system",
          channel: channel,
          userId: "system",
          username: "System",
          displayName: "System",
          color: "#808080",
          badges: [],
          content: [{ type: "text", content: "Connecting to channel..." }],
          rawContent: "Connecting to channel...",
          timestamp: new Date(),
          isDeleted: false,
          isHighlighted: true,
          isAction: false,
        });

        const kickToken = await window.electronAPI.auth.getToken("kick");

        if (!isMounted) return;

        if (kickToken) {
          // Authenticated
          await kickChatService.connect({
            accessToken: kickToken.accessToken,
            debug: import.meta.env.DEV,
          });

          if (!isMounted) return;
          setIsAuthenticated(true);

          // Initialize Kick Emotes
          initializeKickEmotes(kickToken.accessToken);
          if (isMounted) await loadGlobalEmotes();
        } else {
          // Anonymous
          await kickChatService.connect({
            debug: import.meta.env.DEV,
          });

          if (!isMounted) return;
          setIsAuthenticated(false);
          // Just load global emotes (BTTV/7TV)
          if (isMounted) await loadGlobalEmotes();
        }

        if (!isMounted) return;

        // Identify channel ID for emotes
        // Use chatroomId if available, otherwise channel slug
        const channelId = chatroomId ? chatroomId.toString() : channel;

        if (isMounted && channelId) {
          setActiveChannel(channelId);
          await loadChannelEmotes(channelId, channel, "kick");
        } else if (isMounted) {
          setActiveChannel(null);
        }

        if (!isMounted) return;

        if (channel && chatroomId) {
          await kickChatService.joinChannel(channel, chatroomId);

          // System message: Connected
          addMessage({
            id: crypto.randomUUID(),
            platform: "kick",
            type: "system",
            channel: channel,
            userId: "system",
            username: "System",
            displayName: "System",
            color: "#808080",
            badges: [],
            content: [{ type: "text", content: "Connected to the channel" }],
            rawContent: "Connected to the channel",
            timestamp: new Date(),
            isDeleted: false,
            isHighlighted: true,
            isAction: false,
          });
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to connect Kick chat:", error);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;

      // Cleanup: release the service reference
      // In single-view: This will trigger shutdown when activeUsers reaches 0
      // In multi-view: Other components keep the service alive
      if (currentChannelRef.current?.channel) {
        kickChatService.release(currentChannelRef.current.channel);

        // Memory cleanup: unload channel emotes to free RAM
        const channelId = currentChannelRef.current.chatroomId
          ? currentChannelRef.current.chatroomId.toString()
          : currentChannelRef.current.channel;
        unloadChannelEmotes(channelId);
        setActiveChannel(null);
      }
      currentChannelRef.current = null;
    };
  }, [
    channel,
    chatroomId,
    clearMessages,
    loadGlobalEmotes,
    loadChannelEmotes,
    setActiveChannel,
    unloadChannelEmotes,
    addMessage,
  ]);

  // Separate effect for updating subscriber badges without triggering reconnection
  // This is intentionally separate from the connection effect to prevent badge updates
  // from causing the chat to disconnect and reconnect
  useEffect(() => {
    if (channel && subscriberBadges && subscriberBadges.length > 0) {
      kickChatService.setChannelBadges(channel, subscriberBadges);
    }
  }, [channel, subscriberBadges]);

  // Event Listeners
  useEffect(() => {
    const handleMessage = (message: ChatMessage) => {
      if (message.platform === "kick") {
        addMessage(message);
      }
    };

    const handleUserNotice = (notice: UserNotice) => {
      if (notice.platform !== "kick") return;
      const systemMessage: ChatMessage = {
        id: notice.id,
        platform: notice.platform,
        type: "system",
        channel: notice.channel,
        userId: notice.userId,
        username: "System",
        displayName: "System",
        color: "#808080",
        badges: [],
        content: [{ type: "text", content: notice.systemMessage }],
        rawContent: notice.systemMessage,
        timestamp: notice.timestamp,
        isDeleted: false,
        isHighlighted: true,
        isAction: false,
      };
      addMessage(systemMessage);
    };

    const handleConnectionStatus = (status: ChatConnectionStatus) => {
      if (status.platform === "kick") {
        updateConnectionStatus(status);
      }
    };

    const handleClearChat = (clear: ClearChat) => {
      if (clear.platform !== "kick") return;

      if (clear.isClearAll) {
        clearMessages(clear.platform);
      } else if (clear.targetUserId) {
        deleteMessagesByUser(clear.targetUserId);
      }

      const actionText = clear.isClearAll
        ? "Chat was cleared"
        : `${clear.targetUsername} was ${clear.duration ? `timed out for ${clear.duration}s` : "banned"}`;

      addMessage({
        id: crypto.randomUUID(),
        platform: clear.platform,
        type: "system",
        channel: clear.channel,
        userId: "system",
        username: "System",
        displayName: "System",
        color: "#808080",
        badges: [],
        content: [{ type: "text", content: actionText }],
        rawContent: actionText,
        timestamp: clear.timestamp,
        isDeleted: false,
        isHighlighted: true,
        isAction: false,
      });
    };

    const handleMessageDeleted = (deletion: MessageDeletion) => {
      deleteMessage(deletion.messageId);
    };

    const handleError = (error: Error) => {
      console.error("Kick Chat Error:", error);
    };

    kickChatService.on("message", handleMessage);
    kickChatService.on("userNotice", handleUserNotice);
    kickChatService.on("connectionStateChange", handleConnectionStatus);
    kickChatService.on("clearChat", handleClearChat);
    kickChatService.on("messageDeleted", handleMessageDeleted);
    kickChatService.on("error", handleError);

    return () => {
      kickChatService.off("message", handleMessage);
      kickChatService.off("userNotice", handleUserNotice);
      kickChatService.off("connectionStateChange", handleConnectionStatus);
      kickChatService.off("clearChat", handleClearChat);
      kickChatService.off("messageDeleted", handleMessageDeleted);
      kickChatService.off("error", handleError);
    };
  }, [addMessage, updateConnectionStatus, clearMessages, deleteMessage, deleteMessagesByUser]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--color-background-secondary)]">
      <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="text-white">Chat</span>
        </h2>
        <div className="flex space-x-2">{/* Status indicators */}</div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ChatMessageList />
      </div>

      <div className="p-3 border-t border-[var(--color-border)]">
        <ChatInput
          platform="kick"
          channel={channel}
          chatroomId={chatroomId}
          canSend={isAuthenticated && connectionStatus.kick.state === "connected"}
        />
      </div>
    </div>
  );
};
