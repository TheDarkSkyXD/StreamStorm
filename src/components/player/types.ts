
export interface QualityLevel {
    id: string;
    label: string; // "1080p60", "720p", "480p", etc.
    width: number;
    height: number;
    bitrate: number;
    frameRate?: number;
    isAuto?: boolean;
    name?: string;
}

export interface PlayerError {
    code: string;
    message: string;
    fatal: boolean;
    originalError?: any;
}

export type Platform = 'twitch' | 'kick';

export interface StreamPlayback {
    url: string;
    format: 'hls' | 'dash' | 'mp4';
}
