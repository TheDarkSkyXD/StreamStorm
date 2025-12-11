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
    // Additional metadata for passing to video page
    channelSlug?: string;
    channelName?: string;
    channelAvatar?: string | null;
    category?: string;
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
}
