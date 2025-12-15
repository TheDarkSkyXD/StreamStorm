import { Platform } from '@/shared/auth-types';

export interface VideoOrClip {
    id: string;
    title: string;
    duration: string;
    views: string;
    date: string;
    thumbnailUrl: string;
    embedUrl?: string; // For clips
    url?: string; // For clips
    source?: string; // HLS m3u8 URL for VODs (especially Kick)
    gameName?: string;
    isLive?: boolean;
    isSubOnly?: boolean; // Whether the VOD is subscriber-only content
    // Additional metadata for passing to video page
    channelSlug?: string;
    channelName?: string;
    channelAvatar?: string | null;
    category?: string;
    // Stream tags
    tags?: string[];
    language?: string;
    isMature?: boolean;
}

export interface ClipPlayerProps {
    src: string;
    autoPlay?: boolean;
    onError?: () => void;
}

export interface RelatedContentProps {
    platform: Platform;
    channelName: string;
    channelData: import('@/backend/api/unified/platform-types').UnifiedChannel | null | undefined;
    onClipSelectionChange?: (isOpen: boolean) => void;
}
