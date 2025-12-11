import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS classes
 * Uses clsx for conditional classes and tailwind-merge to avoid conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format viewer count to K/M format
 * e.g. 1200 -> 1.2K, 1500000 -> 1.5M
 */
export function formatViewerCount(count: number | undefined | null): string {
  if (!count) return '0';
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

/**
 * Format relative time (e.g. "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

/**
 * Format duration in seconds to HH:MM:SS or MM:SS
 * Shows HH:MM:SS when duration is 1 hour or more (e.g. 04:21:10)
 * Shows MM:SS for shorter durations (e.g. 05:30)
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    // Format as HH:MM:SS with padded hours for long streams
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  // Format as MM:SS for shorter durations
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Normalize category name for cross-platform comparison
 * Handles special cases like "Slots" vs "Slots & Casino"
 */
export function normalizeCategoryName(name: string): string {
  const key = name.toLowerCase().trim();
  if (key === 'slots' || key === 'slots & casino') {
    return '@@slots@@';
  }
  return key;
}

/**
 * Format uptime from a startedAt ISO date string to HH:MM:SS format
 * e.g. "2025-12-10T21:00:00Z" -> "1:15:33" if stream has been live for 1 hour, 15 mins, 33 secs
 */
export function formatUptime(startedAt: string | undefined | null): string {
  if (!startedAt) return '0:00:00';

  const start = new Date(startedAt);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);

  if (diffInSeconds < 0) return '0:00:00';

  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);
  const seconds = Math.floor(diffInSeconds % 60);

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
