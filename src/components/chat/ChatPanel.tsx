import React from 'react';
import { TwitchChat } from './twitch/TwitchChat';
import { KickChat } from './kick/KickChat';
import type { ChatPlatform } from '../../shared/chat-types';

export interface ChatPanelProps {
    /** Initial platform to display/send to */
    initialPlatform?: ChatPlatform;
    /** Initial channel name */
    initialChannel?: string;
    /** Chatroom ID for Kick (if applicable) */
    chatroomId?: number;
    /** Channel ID for Twitch (string) or Kick (number/string) */
    channelId?: string;
    /** Subscriber badges for Kick (if applicable) */
    subscriberBadges?: any[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
    initialPlatform = 'twitch',
    initialChannel = '',
    chatroomId,
    channelId,
    subscriberBadges,
}) => {
    // Note: Global emotes are loaded by child components (TwitchChat/KickChat)
    // after they configure their respective providers with credentials

    if (initialPlatform === 'kick') {
        return (
            <KickChat
                channel={initialChannel}
                chatroomId={chatroomId}
                subscriberBadges={subscriberBadges}
            />
        );
    }

    return (
        <TwitchChat
            channel={initialChannel}
            channelId={channelId}
        />
    );
};

