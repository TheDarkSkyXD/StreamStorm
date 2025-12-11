/**
 * Kick Player Components
 * 
 * Kick-specific video players:
 * - KickLivePlayer: For live streams (no progress bar)
 * - KickVodPlayer: For VODs (with green progress bar)
 */

// Live Stream Player (no progress bar)
export { KickLivePlayer } from './kick-live-player';
export { KickLivePlayerControls } from './kick-live-player-controls';

// VOD Player (with green progress bar)
export { KickVodPlayer } from './kick-vod-player';
export { KickVodPlayerControls } from './kick-vod-player-controls';

// Progress Bar (for VODs)
export { KickProgressBar } from './kick-progress-bar';

// Legacy exports (for backward compatibility)
export { KickVideoPlayer } from './kick-video-player';
export { KickPlayerControls } from './kick-player-controls';

