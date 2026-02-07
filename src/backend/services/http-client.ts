/**
 * Robust HTTP Client for Twitch GQL and API Requests
 * 
 * This module provides a centralized HTTP client with:
 * - Proper retry logic with exponential backoff and jitter
 * - Circuit breaker pattern for temporary failures
 * - Comprehensive handling of undici/Node.js fetch error codes
 * 
 * Addresses ECONNRESET and UND_ERR_CONNECT_TIMEOUT errors that occur
 * during TLS handshake with gql.twitch.tv.
 */

// ============================================================================
// Types
// ============================================================================

interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
}

interface CircuitBreakerState {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
}



// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 4,
    baseDelayMs: 500,
    maxDelayMs: 8000,
    timeoutMs: 20000, // Increased from 15s to 20s for TLS handshake
};

// Circuit breaker settings
const CIRCUIT_BREAKER = {
    failureThreshold: 5,
    resetTimeoutMs: 30000, // 30 seconds before trying again
};

// Retryable error codes - includes undici-specific codes
const RETRYABLE_ERROR_CODES = new Set([
    'ECONNRESET',               // Connection reset (TLS handshake failure)
    'ETIMEDOUT',                // Connection timed out
    'ENOTFOUND',                // DNS lookup failed (transient)
    'ECONNREFUSED',             // Connection refused
    'ENETUNREACH',              // Network unreachable
    'EHOSTUNREACH',             // Host unreachable
    'EPIPE',                    // Broken pipe
    'EAI_AGAIN',                // DNS temporary failure
    'UND_ERR_CONNECT_TIMEOUT',  // Undici connect timeout
    'UND_ERR_SOCKET',           // Undici socket error
    'UND_ERR_HEADERS_TIMEOUT',  // Undici headers timeout
    'UND_ERR_BODY_TIMEOUT',     // Undici body timeout
]);

// Retryable message patterns
const RETRYABLE_MESSAGE_PATTERNS = [
    'fetch failed',
    'network',
    'socket',
    'disconnected',
    'connect timeout',
    'connection reset',
    'ssl',
    'tls',
    'handshake',
    'econnreset',
    'etimedout',
];

// ============================================================================
// HTTP Client Singleton
// ============================================================================

class RobustHttpClient {
    private circuitBreakers = new Map<string, CircuitBreakerState>();

    /**
     * Make a fetch request with automatic retry and circuit breaker
     * 
     * Note: Request deduplication was removed because Response bodies can only 
     * be consumed once, and sharing responses between callers caused "Body has 
     * already been read" errors.
     */
    async fetch(
        url: string,
        options: RequestInit = {},
        retryOptions: RetryOptions = {}
    ): Promise<Response> {
        const opts = { ...DEFAULT_OPTIONS, ...retryOptions };
        const origin = new URL(url).origin;

        // Check circuit breaker
        if (this.isCircuitOpen(origin)) {
            throw new Error(`Circuit breaker open for ${origin}. Too many recent failures.`);
        }

        try {
            const response = await this.executeWithRetry(url, options, opts, origin);
            this.recordSuccess(origin);
            return response;
        } catch (error) {
            this.recordFailure(origin);
            throw error;
        }
    }

    /**
     * Execute request with retry logic
     */
    private async executeWithRetry(
        url: string,
        options: RequestInit,
        retryOpts: Required<RetryOptions>,
        origin: string
    ): Promise<Response> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= retryOpts.maxRetries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), retryOpts.timeoutMs);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });

                // Retry on transient server errors (502, 503, 504)
                if (response.status >= 502 && response.status <= 504) {
                    if (attempt < retryOpts.maxRetries) {
                        const delay = this.calculateDelay(attempt, retryOpts);
                        console.warn(
                            `⚠️ Server error ${response.status} from ${origin} (attempt ${attempt + 1}/${retryOpts.maxRetries + 1}). Retrying in ${delay}ms...`
                        );
                        await this.sleep(delay);
                        continue;
                    }
                    throw new Error(`Server error: ${response.status} after ${retryOpts.maxRetries + 1} attempts`);
                }

                return response;
            } catch (error) {
                lastError = error as Error;

                // Check if it's a timeout (AbortError)
                const isTimeout = error instanceof Error && error.name === 'AbortError';
                const isRetryable = isTimeout || this.isRetryableError(error);

                if (!isRetryable || attempt === retryOpts.maxRetries) {
                    throw error;
                }

                const delay = this.calculateDelay(attempt, retryOpts);
                const errorCode = this.getErrorCode(error);
                const errorMsg = (error as Error).message || 'Unknown error';
                const errorType = isTimeout ? 'TIMEOUT' : (errorCode || 'NETWORK');

                console.warn(
                    `⚠️ Request failed [${errorType}] to ${origin} (attempt ${attempt + 1}/${retryOpts.maxRetries + 1}). Retrying in ${delay}ms... Error: ${errorMsg}`
                );

                await this.sleep(delay);
            } finally {
                clearTimeout(timeoutId);
            }
        }

        throw lastError || new Error('Request failed after retries');
    }

    /**
     * Check if error is retryable
     */
    private isRetryableError(error: unknown): boolean {
        if (!(error instanceof Error)) return false;

        const code = this.getErrorCode(error);

        // Check against known retryable codes
        if (code && RETRYABLE_ERROR_CODES.has(code)) {
            return true;
        }

        // Check error message patterns
        const message = error.message.toLowerCase();
        return RETRYABLE_MESSAGE_PATTERNS.some(pattern => message.includes(pattern));
    }

    /**
     * Extract error code from error or its cause
     */
    private getErrorCode(error: unknown): string | undefined {
        if (!(error instanceof Error)) return undefined;

        // Check cause first (Node.js fetch wraps the real error)
        const errorWithCause = error as Error & { cause?: { code?: string } };
        if (errorWithCause.cause?.code) {
            return errorWithCause.cause.code;
        }

        // Check direct code property
        const errorWithCode = error as Error & { code?: string };
        if (errorWithCode.code) {
            return errorWithCode.code;
        }

        return undefined;
    }

    /**
     * Calculate delay with jitter for retry
     */
    private calculateDelay(attempt: number, opts: Required<RetryOptions>): number {
        // Exponential backoff with jitter
        const exponential = opts.baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * opts.baseDelayMs * 0.5;
        return Math.min(exponential + jitter, opts.maxDelayMs);
    }



    /**
     * Check if circuit breaker is open for an origin
     */
    private isCircuitOpen(origin: string): boolean {
        const state = this.circuitBreakers.get(origin);
        if (!state) return false;

        if (state.isOpen) {
            // Check if reset timeout has passed
            if (Date.now() - state.lastFailure > CIRCUIT_BREAKER.resetTimeoutMs) {
                state.isOpen = false;
                state.failures = 0;
                console.debug(`[HttpClient] Circuit breaker reset for ${origin}`);
                return false;
            }
            return true;
        }

        return false;
    }

    /**
     * Record a successful request
     */
    private recordSuccess(origin: string): void {
        const state = this.circuitBreakers.get(origin);
        if (state) {
            state.failures = 0;
            state.isOpen = false;
        }
    }

    /**
     * Record a failed request
     */
    private recordFailure(origin: string): void {
        let state = this.circuitBreakers.get(origin);
        if (!state) {
            state = { failures: 0, lastFailure: 0, isOpen: false };
            this.circuitBreakers.set(origin, state);
        }

        state.failures++;
        state.lastFailure = Date.now();

        if (state.failures >= CIRCUIT_BREAKER.failureThreshold) {
            state.isOpen = true;
            console.warn(`[HttpClient] Circuit breaker OPEN for ${origin} after ${state.failures} failures`);
        }
    }

    /**
     * Helper sleep function
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset circuit breaker for an origin
     */
    resetCircuitBreaker(origin: string): void {
        this.circuitBreakers.delete(origin);
    }

    /**
     * Clear all state
     */
    clear(): void {
        this.circuitBreakers.clear();
    }

    /**
     * Get statistics about the client
     */
    getStats(): { circuitBreakers: Record<string, CircuitBreakerState> } {
        const circuitBreakers: Record<string, CircuitBreakerState> = {};
        for (const [origin, state] of this.circuitBreakers) {
            circuitBreakers[origin] = { ...state };
        }
        return {
            circuitBreakers,
        };
    }
}

// Export singleton instance
export const httpClient = new RobustHttpClient();

// Export types
export type { RetryOptions };
