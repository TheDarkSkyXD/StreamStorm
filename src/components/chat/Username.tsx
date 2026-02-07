import React from 'react';
import { ChatPlatform } from '../../shared/chat-types';

interface UsernameProps {
    userId: string;
    username: string;
    displayName: string;
    color?: string;
    platform: ChatPlatform;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const Username: React.FC<UsernameProps> = ({
    userId,
    username,
    displayName,
    color,
    platform,
    className,
    onClick
}) => {
    const defaultColor = platform === 'kick' ? '#53fc18' : '#9146ff';

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick(e);
        } else {
            console.log(`User clicked: ${username} (${userId})`);
            // TODO: Open user card
        }
    };

    return (
        <span
            className={`font-bold cursor-pointer hover:underline ${className || ''}`}
            style={{ color: color || defaultColor }}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleClick(e as unknown as React.MouseEvent);
                }
            }}
        >
            {displayName}
        </span>
    );
};
