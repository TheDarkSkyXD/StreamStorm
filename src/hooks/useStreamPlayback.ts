import { useCallback, useEffect, useRef, useState } from "react";

import type { StreamPlayback } from "@/components/player/types";
import type { Platform } from "@/shared/auth-types";

// Maximum reload attempts before giving up (prevents infinite loops)
const MAX_RELOAD_ATTEMPTS = 3;

interface UseStreamPlaybackResult {
  playback: StreamPlayback | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** Whether the current playback URL is using a proxy (Twitch only) */
  isUsingProxy: boolean;
  /** Retry loading the stream without proxy (fallback to direct) */
  retryWithoutProxy: () => void;
  /** Number of consecutive reload attempts (resets on successful playback) */
  reloadAttempts: number;
}

export function useStreamPlayback(platform: Platform, identifier: string): UseStreamPlaybackResult {
  const [playback, setPlayback] = useState<StreamPlayback | null>(null);
  const [isLoading, setIsLoading] = useState(!!identifier);
  const [error, setError] = useState<Error | null>(null);
  const [_reloadKey, setReloadKey] = useState(0);
  // Track if we're using proxy to enable fallback
  const [isUsingProxy, setIsUsingProxy] = useState(false);
  // Force disable proxy for fallback
  const [forceNoProxy, setForceNoProxy] = useState(false);
  // Track reload attempts to prevent infinite loops
  // Use ref for synchronous access in callbacks, state for consumers
  const reloadAttemptsRef = useRef(0);
  const [reloadAttempts, setReloadAttempts] = useState(0);

  const _currentKey = `${platform}-${identifier}`;

  useEffect(() => {
    // Reset all state when stream identifier changes
    setPlayback(null);
    setIsLoading(!!identifier);
    setError(null);
    setIsUsingProxy(false);
    setForceNoProxy(false);
    reloadAttemptsRef.current = 0; // Sync ref
    setReloadAttempts(0); // Reset attempts when stream changes
  }, [identifier]);

  useEffect(() => {
    if (!identifier) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchUrl = async () => {
      try {
        if (!window.electronAPI) {
          throw new Error("Electron API not available");
        }

        // Use IPC to fetch playback URL from main process
        const result = await window.electronAPI.streams.getPlaybackUrl({
          platform,
          channelSlug: identifier,
        });

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to get stream playback URL");
        }

        if (isMounted) {
          setPlayback({
            url: result.data.url,
            format: result.data.format as "hls" | "dash" | "mp4",
          });
          // Detect if this is a proxy URL (check for known proxy domains)
          const url = result.data.url;
          const usingProxy =
            (url.includes("cdn-perfprod.com") || url.includes("luminous.dev")) && !forceNoProxy;
          console.debug(`[useStreamPlayback] Loaded URL:`, {
            url: `${url.substring(0, 80)}...`,
            isProxy: usingProxy,
            forceNoProxy,
          });
          setIsUsingProxy(usingProxy);
          setIsLoading(false);
          reloadAttemptsRef.current = 0; // Sync ref
          setReloadAttempts(0); // Reset on successful load
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          // "Channel is offline" and "not found" are expected behaviors, not errors - don't log them
          const errorMessageLower = error.message.toLowerCase();
          const isExpectedError =
            errorMessageLower.includes("offline") || errorMessageLower.includes("not found");
          if (!isExpectedError) {
            console.error(`Failed to load stream playback for ${platform}/${identifier}`, err);
          }
          setError(error);
          setIsLoading(false);
        }
      }
    };

    fetchUrl();

    return () => {
      isMounted = false;
    };
  }, [platform, identifier, forceNoProxy]);

  const retryWithoutProxy = useCallback(() => {
    console.debug("[useStreamPlayback] Retrying without proxy (fallback to direct)");
    setForceNoProxy(true);
    setPlayback(null);
    setError(null);
    setReloadKey((prev) => prev + 1);
  }, []);

  // Reload with rate limiting to prevent infinite loops
  // Uses a ref for synchronous tracking since React state updates are async/batched
  const reload = useCallback(() => {
    if (reloadAttemptsRef.current >= MAX_RELOAD_ATTEMPTS) {
      console.debug(
        `[useStreamPlayback] Max reload attempts (${MAX_RELOAD_ATTEMPTS}) reached, stopping`
      );
      setError(new Error("Max reload attempts reached - stream may be offline"));
      return;
    }
    reloadAttemptsRef.current += 1;
    setReloadAttempts(reloadAttemptsRef.current); // Keep state in sync for consumers
    setReloadKey((prev) => prev + 1);
  }, []);

  return {
    playback,
    isLoading,
    error,
    isUsingProxy,
    reload,
    retryWithoutProxy,
    reloadAttempts,
  };
}
