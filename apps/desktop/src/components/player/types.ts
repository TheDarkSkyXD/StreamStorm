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

// Standardized error codes for player error handling
export type PlayerErrorCode =
  | "STREAM_OFFLINE" // Stream is offline or unavailable
  | "PROXY_ERROR" // Proxy server error (500, etc.)
  | "TOKEN_EXPIRED" // Playback token has expired
  | "NO_FRAGMENTS" // No video fragments received after manifest load
  | "MEDIA_ERROR" // Fatal media/decoding error
  | "HLS_FATAL" // Unrecoverable HLS error
  | "NATIVE_ERROR" // Native playback error (Safari HLS)
  | "PLAYBACK_ERROR"; // Generic playback failure

export interface PlayerError {
  code: PlayerErrorCode | string;
  message: string;
  fatal: boolean;
  originalError?: unknown;
  /** If true, caller should attempt to refresh playback URL */
  shouldRefresh?: boolean;
}

export type Platform = "twitch" | "kick";

export interface StreamPlayback {
  url: string;
  format: "hls" | "dash" | "mp4";
  qualities?: {
    quality: string;
    url: string;
    frameRate?: number;
  }[];
}
