/**
 * Chat Components Index
 *
 * Exports all chat-related UI components.
 * Chat components work with both Twitch and Kick chat systems.
 */

export { ChatPanel } from './ChatPanel';
export type { ChatPanelProps } from './ChatPanel';
export { ChatMessage } from './ChatMessage';
export { ChatMessageList } from './ChatMessageList';
export { ChatInput } from './ChatInput';
export type { ChatInputProps, ChatInputHandle } from './ChatInput';
export { Username } from './Username';
export { EmoteImage } from './EmoteImage';
export { EmotePicker } from './EmotePicker';
export { EmoteAutocomplete, useEmoteAutocomplete } from './EmoteAutocomplete';
export { MentionAutocomplete, useMentionAutocomplete } from './MentionAutocomplete';
export type { RecentChatter } from './MentionAutocomplete';

// Will be added in future phases
// export { ChatUserList } from './ChatUserList';

