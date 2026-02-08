/**
 * Stream Components
 *
 * This directory contains components for stream viewing functionality.
 *
 * Structure:
 * - Root level: Platform-agnostic shared components
 * - /twitch: Twitch-specific components
 * - /kick: Kick-specific components
 * - /related-content: Modular related content components (videos, clips)
 */

// Shared components
export { FeaturedStream } from "./featured-stream";
// Types
export type { RelatedContentProps, VideoOrClip } from "./related-content";
export { RelatedContent } from "./related-content";
export { StreamCard } from "./stream-card";
export { StreamCardSkeleton } from "./stream-card-skeleton";
export { StreamGrid } from "./stream-grid";
export { StreamInfo } from "./stream-info";

// Platform-specific exports (add as they are created)
// export * from './twitch';
// export * from './kick';
