/**
 * API Module Index
 *
 * Central export point for all API-related functionality.
 */

// Unified types and interfaces
export * from './unified';

// Platform-specific modules
export * as TwitchApi from './platforms/twitch';
export * as KickApi from './platforms/kick';
