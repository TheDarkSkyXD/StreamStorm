import type React from "react";
import { memo, useMemo } from "react";
import type { ChatMessage as ChatMessageType, ContentFragment } from "../../shared/chat-types";
import { ChatBadge } from "./ChatBadge";
import { ChatEmote } from "./ChatEmote";
import { Username } from "./Username";

interface ChatMessageProps {
  message: ChatMessageType;
  style?: React.CSSProperties;
}

/**
 * ChatMessage Component - Performance Optimized
 *
 * Uses React.memo to prevent unnecessary re-renders when message data hasn't changed.
 * Timestamp is memoized to avoid recalculating on every render.
 */
export const ChatMessage: React.FC<ChatMessageProps> = memo(({ message, style }) => {
  const isDeleted = message.isDeleted;

  if (isDeleted) {
    return (
      <div className="px-4 py-1 text-sm text-gray-500 italic opacity-50" style={style}>
        Message deleted
      </div>
    );
  }

  return (
    <div
      className={`px-4 py-1 text-sm hover:bg-white/5 leading-[1.4] ${message.isHighlighted ? "bg-purple-500/10 border-l-2 border-purple-500" : ""}`}
      style={style}
    >
      <div className="break-words">
        {/* Timestamp - memoized to prevent recalculation */}
        <Timestamp timestamp={message.timestamp} />

        {/* Badges */}
        {message.badges.length > 0 && (
          <span className="align-middle inline-block mr-1">
            {message.badges
              .filter((badge) => badge.imageUrl)
              .map((badge, index) => (
                <ChatBadge
                  key={`${badge.setId}-${index}`}
                  badge={badge}
                  platform={message.platform}
                />
              ))}
          </span>
        )}

        {/* Username */}
        <span className="align-middle inline">
          <Username
            userId={message.userId}
            username={message.username}
            displayName={message.displayName}
            color={message.color}
            platform={message.platform}
            className="align-middle"
          />
        </span>

        {/* Separator for regular messages */}
        {!message.isAction && <span className="mr-1 align-middle">:</span>}

        {/* Content */}
        <span
          className={`align-middle ${message.isAction ? "italic" : ""}`}
          style={message.isAction ? { color: message.color } : undefined}
        >
          {message.content.map((fragment, index) => (
            <MessageFragment key={index} fragment={fragment} platform={message.platform} />
          ))}
        </span>
      </div>
    </div>
  );
});

ChatMessage.displayName = "ChatMessage";

// Memoized timestamp component
const Timestamp: React.FC<{ timestamp: Date }> = memo(({ timestamp }) => {
  const formattedTime = useMemo(() => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [timestamp]);

  return (
    <span className="text-xs text-white font-bold mr-1 select-none align-middle inline-block">
      {formattedTime}
    </span>
  );
});

Timestamp.displayName = "Timestamp";

// Memoized message fragment component
const MessageFragment: React.FC<{ fragment: ContentFragment; platform: "twitch" | "kick" }> = memo(
  ({ fragment, platform }) => {
    switch (fragment.type) {
      case "text":
        return <span>{fragment.content}</span>;

      case "emote":
        return (
          <ChatEmote
            id={fragment.id}
            name={fragment.name}
            url={fragment.url}
            platform={platform}
            isAnimated={fragment.isAnimated}
          />
        );

      case "mention":
        return (
          <span className="bg-white/10 font-bold px-1 rounded mx-0.5 text-white">
            {fragment.username}
          </span>
        );

      case "link":
        return (
          <a
            href={fragment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline break-all"
          >
            {fragment.text}
          </a>
        );

      case "cheermote":
        return (
          <span className="inline-flex items-center mx-1 text-purple-400 font-bold">
            <img src={fragment.url} alt={fragment.name} className="h-6 w-6 mr-1" />
            {fragment.bits}
          </span>
        );

      default:
        return null;
    }
  }
);

MessageFragment.displayName = "MessageFragment";
