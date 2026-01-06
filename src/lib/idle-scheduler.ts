/**
 * Idle Scheduler Utilities
 *
 * Provides utilities for scheduling low-priority tasks during browser idle time
 * using requestIdleCallback. This helps keep the main thread responsive by
 * deferring non-critical work.
 *
 * Features:
 * - requestIdleCallback wrapper with fallback for unsupported browsers
 * - Task batching for multiple related operations
 * - Priority levels for different task importance
 * - Timeout support to ensure tasks eventually run
 *
 * Use Cases:
 * - Analytics and telemetry logging
 * - Cache cleanup and memory management
 * - Preloading of non-critical resources
 * - Lazy initialization of features
 *
 * @module lib/idle-scheduler
 */

type IdleCallbackHandle = number | ReturnType<typeof setTimeout>;

interface IdleTaskOptions {
    /** Timeout in ms after which the task will run even if browser is busy (default: 10000) */
    timeout?: number;
}

/**
 * Check if requestIdleCallback is available
 */
export const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;

/**
 * Schedule a callback to run during browser idle time
 * Falls back to setTimeout for browsers without requestIdleCallback support
 *
 * @param callback - Function to run during idle time
 * @param options - Configuration options
 * @returns Handle that can be used to cancel the callback
 */
export function scheduleIdleTask(
    callback: (deadline?: IdleDeadline) => void,
    options: IdleTaskOptions = {}
): IdleCallbackHandle {
    const { timeout = 10000 } = options;

    if (hasIdleCallback) {
        return window.requestIdleCallback(callback, { timeout });
    }

    // Fallback: use setTimeout with a short delay to simulate "idle" behavior
    // The timeout parameter is for forcing execution when busy, not the delay
    return setTimeout(() => callback(), 50);
}

/**
 * Cancel a previously scheduled idle callback
 *
 * @param handle - Handle returned from scheduleIdleTask
 */
export function cancelIdleTask(handle: IdleCallbackHandle): void {
    if (hasIdleCallback && typeof handle === 'number') {
        window.cancelIdleCallback(handle);
    } else {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
}

/**
 * Schedule a task to run periodically during idle time
 * More efficient than setInterval for low-priority periodic tasks
 *
 * @param callback - Function to run periodically
 * @param intervalMs - Minimum interval between runs in milliseconds
 * @param options - Configuration options
 * @returns Cleanup function to stop the periodic execution
 */
export function schedulePeriodicIdleTask(
    callback: () => void,
    intervalMs: number,
    options: IdleTaskOptions = {}
): () => void {
    let handle: IdleCallbackHandle | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let isRunning = true;

    const runTask = (deadline?: IdleDeadline) => {
        if (!isRunning) return;

        // Check if we have enough idle time (at least 1ms) or if it's urgent
        const shouldRun = !deadline || deadline.timeRemaining() >= 1 || deadline.didTimeout;

        if (shouldRun) {
            try {
                callback();
            } catch (e) {
                console.error('[IdleScheduler] Task error:', e);
            }
        }

        // Schedule next run after the interval
        if (isRunning) {
            timeoutHandle = setTimeout(() => {
                handle = scheduleIdleTask(runTask, options);
            }, intervalMs);
        }
    };

    // Start the first run after a short delay
    timeoutHandle = setTimeout(() => {
        handle = scheduleIdleTask(runTask, options);
    }, 100);

    // Return cleanup function
    return () => {
        isRunning = false;
        if (handle !== null) {
            cancelIdleTask(handle);
        }
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
        }
    };
}

/**
 * Run a batch of tasks during idle time
 * Useful for processing arrays of items without blocking the main thread
 *
 * @param tasks - Array of tasks to run
 * @param options - Configuration options
 * @returns Promise that resolves when all tasks are complete
 */
export async function runIdleBatch<T>(
    tasks: (() => T)[],
    options: IdleTaskOptions & { batchSize?: number } = {}
): Promise<T[]> {
    const { batchSize = 5, timeout = 10000 } = options;
    const results: T[] = [];
    let taskIndex = 0;

    while (taskIndex < tasks.length) {
        const batchEnd = Math.min(taskIndex + batchSize, tasks.length);
        const batch = tasks.slice(taskIndex, batchEnd);

        await new Promise<void>((resolve) => {
            scheduleIdleTask((deadline) => {
                let executedCount = 0;
                for (const task of batch) {
                    // Check if we're running out of idle time
                    if (deadline && deadline.timeRemaining() < 1) {
                        // We'll continue in the next idle period
                        break;
                    }

                    try {
                        results.push(task());
                        executedCount++;
                    } catch (e) {
                        console.error('[IdleScheduler] Batch task error:', e);
                        executedCount++; // Count failed tasks as processed
                    }
                }
                taskIndex += executedCount;
                resolve();
            }, { timeout });
        });
    }

    return results;
}

/**
 * Defer initialization of a feature until the browser is idle
 * Useful for lazy loading non-critical functionality
 *
 * @param initFn - Initialization function
 * @param options - Configuration options
 * @returns Promise that resolves with the initialization result
 */
export function deferredInit<T>(
    initFn: () => T | Promise<T>,
    options: IdleTaskOptions = {}
): Promise<T> {
    return new Promise((resolve, reject) => {
        scheduleIdleTask(async () => {
            try {
                const result = await initFn();
                resolve(result);
            } catch (e) {
                reject(e);
            }
        }, options);
    });
}
