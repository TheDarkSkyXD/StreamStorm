/**
 * Player Components Index
 *
 * Exports all video player-related UI components.
 * The base player component works with both Twitch and Kick streams.
 * Platform-specific players are available in their respective subfolders.
 */

// Base/Generic Player (for backward compatibility)
export { VideoPlayer } from './video-player';
export { PlayerControls } from './player-controls';
export { QualitySelector } from './quality-selector';
export { VolumeControl } from './volume-control';
export { SettingsMenu } from './settings-menu';
export { ProgressBar } from './progress-bar';
export { PlayPauseButton } from './play-pause-button';
export { HlsPlayer } from './hls-player';
export { PerformanceEnhancedPlayer, PerformanceIndicator } from './performance-enhanced-player';

// Platform-Specific Players
// Kick - Live (no progress bar) and VOD (with green progress bar)
export {
    KickLivePlayer,
    KickLivePlayerControls,
    KickVodPlayer,
    KickVodPlayerControls,
    KickProgressBar,
    // Legacy exports
    KickVideoPlayer,
    KickPlayerControls
} from './kick';

// Twitch - Live (no progress bar) and VOD (with purple progress bar)
export {
    TwitchLivePlayer,
    TwitchLivePlayerControls,
    TwitchVodPlayer,
    TwitchVodPlayerControls,
    TwitchProgressBar,
    // Legacy exports
    TwitchVideoPlayer,
    TwitchPlayerControls
} from './twitch';

// Hooks
export { useFullscreen } from './use-fullscreen';
export { usePictureInPicture } from './use-picture-in-picture';
export { usePlayerKeyboard } from './use-player-keyboard';
export { useResumePlayback } from './use-resume-playback';
export { useDefaultQuality } from './use-default-quality';

// Performance Optimization Hooks (Phase 3.7)
export { useAdaptiveQuality } from './use-adaptive-quality';
export { useBackgroundThrottle, useMultistreamThrottle } from './use-background-throttle';
export {
    useVideoLifecycle,
    useMultiVideoLifecycle,
    useVideoChurnDetection,
    cleanupVideoElement
} from './use-video-lifecycle';

// Types
export * from './types';
