/**
 * Player Components Index
 *
 * Exports all video player-related UI components.
 * The base player component works with both Twitch and Kick streams.
 * Platform-specific players are available in their respective subfolders.
 */

export { HlsPlayer } from "./hls-player";
// Performance Optimization Hooks (Phase 3.7)
export { useAdaptiveQuality } from "./hooks/use-adaptive-quality";
export { useBackgroundThrottle, useMultistreamThrottle } from "./hooks/use-background-throttle";
export { useDefaultQuality } from "./hooks/use-default-quality";
// Hooks
export { useFullscreen } from "./hooks/use-fullscreen";
export { usePictureInPicture } from "./hooks/use-picture-in-picture";
export { usePlayerKeyboard } from "./hooks/use-player-keyboard";
export { useResumePlayback } from "./hooks/use-resume-playback";
export {
  cleanupVideoElement,
  useMultiVideoLifecycle,
  useVideoChurnDetection,
  useVideoLifecycle,
} from "./hooks/use-video-lifecycle";

// Platform-Specific Players
// Kick - Live (no progress bar) and VOD (with green progress bar)
export {
  KickLivePlayer,
  KickLivePlayerControls,
  KickPlayerControls,
  KickProgressBar,
  // Legacy exports
  KickVideoPlayer,
  KickVodPlayer,
  KickVodPlayerControls,
} from "./kick";
export { PerformanceEnhancedPlayer, PerformanceIndicator } from "./performance-enhanced-player";
export { PlayPauseButton } from "./play-pause-button";
export { PlayerControls } from "./player-controls";
export { ProgressBar } from "./progress-bar";
export { QualitySelector } from "./quality-selector";
export { SettingsMenu } from "./settings-menu";
// Twitch - Live (no progress bar) and VOD (with purple progress bar)
export {
  TwitchLivePlayer,
  TwitchLivePlayerControls,
  TwitchPlayerControls,
  TwitchProgressBar,
  // Legacy exports
  TwitchVideoPlayer,
  TwitchVodPlayer,
  TwitchVodPlayerControls,
} from "./twitch";
// Types
export * from "./types";
// Base/Generic Player (for backward compatibility)
export { VideoPlayer } from "./video-player";
export { VolumeControl } from "./volume-control";
