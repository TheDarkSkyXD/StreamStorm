
import { useParams } from '@tanstack/react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ProxiedImage } from '@/components/ui/proxied-image';
import { useChannelByUsername } from '@/hooks/queries/useChannels';
import { useStreamByChannel } from '@/hooks/queries/useStreams';
import { Platform } from '@/shared/auth-types';
import { KickLivePlayer } from '@/components/player/kick';
import { TwitchLivePlayer } from '@/components/player/twitch';
import { PlayerError } from '@/components/player/types';
import { useStreamPlayback } from '@/hooks/useStreamPlayback';
import { StreamInfo } from '@/components/stream/stream-info';
import { RelatedContent } from '@/components/stream/related-content';
import { KickLoadingSpinner, TwitchLoadingSpinner } from '@/components/ui/loading-spinner';
import { usePipStore } from '@/store/pip-store';
import { useAppStore } from '@/store/app-store';

export function StreamPage() {
  const { platform, channel: channelName } = useParams({ from: '/_app/stream/$platform/$channel' });

  // Playback URL resolution
  const {
    playback,
    isLoading: isPlaybackLoading,
    reload: reloadPlayback,
    isUsingProxy,
    retryWithoutProxy
  } = useStreamPlayback(platform as Platform, channelName);

  // Real data fetching
  const { data: channelData, isLoading: isChannelLoading } = useChannelByUsername(channelName, platform as Platform);
  const { data: streamData, isLoading: isStreamLoading } = useStreamByChannel(channelName, platform as Platform);

  // Chat Resizing Logic
  const [chatWidth, setChatWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  // Theater Mode Logic - synced with app store for sidebar auto-collapse
  const { isTheaterModeActive: isTheater, setTheaterModeActive } = useAppStore();

  // Player error state (e.g., stream offline even though URL was provided)
  const [playerError, setPlayerError] = useState<PlayerError | null>(null);

  // Track clip dialog state to mute main player
  const [isClipDialogOpen, setIsClipDialogOpen] = useState(false);

  // Proxy fallback notification state
  const [proxyFallbackNotice, setProxyFallbackNotice] = useState<string | null>(null);
  const fallbackTimeoutRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, []);

  // Helper to trigger proxy fallback with notice and timeout management
  const triggerProxyFallback = useCallback((message: string) => {
    console.debug('[StreamPage] Triggering fallback to direct stream');
    setProxyFallbackNotice(message);
    retryWithoutProxy();
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = window.setTimeout(() => setProxyFallbackNotice(null), 8000);
  }, [retryWithoutProxy]);

  const handlePlayerError = useCallback((error: PlayerError) => {
    console.debug(`[StreamPage] handlePlayerError called:`, {
      code: error.code,
      isUsingProxy,
      platform,
      message: error.message,
      shouldRefresh: error.shouldRefresh
    });

    // Handle errors that suggest we need a fresh playback URL
    // TOKEN_EXPIRED: Playback token expired, need new URL
    // NO_FRAGMENTS: No video data received after manifest - likely stale URL or offline
    if (error.code === 'TOKEN_EXPIRED' || error.code === 'NO_FRAGMENTS') {
      console.debug(`[StreamPage] ${error.code} - attempting automatic refresh`);
      setProxyFallbackNotice(
        error.code === 'TOKEN_EXPIRED'
          ? 'Playback session expired. Refreshing stream...'
          : 'Stream data unavailable. Refreshing...'
      );
      reloadPlayback(); // Fetch fresh playback URL
      // Auto-hide notification after 5 seconds
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = window.setTimeout(() => setProxyFallbackNotice(null), 5000);
      return; // Don't show error, let refresh attempt
    }

    // PROXY_ERROR is specific to proxy server failures (500 errors)
    if (error.code === 'PROXY_ERROR' && isUsingProxy && platform === 'twitch') {
      triggerProxyFallback('Proxy server unavailable. Falling back to direct stream (ads may show).');
      return; // Don't show error, let fallback attempt
    }

    // STREAM_OFFLINE is expected when a stream ends - use debug logging
    if (error.code === 'STREAM_OFFLINE') {
      console.debug('Stream ended or went offline');

      // If we were using proxy and got a network/offline error, try fallback to direct
      if (isUsingProxy && platform === 'twitch') {
        triggerProxyFallback('Proxy connection failed. Falling back to direct stream.');
        return; // Don't show error yet, let fallback attempt
      }
    } else {
      console.error('Player error', error);

      // Also try fallback for other network errors when using proxy
      if (isUsingProxy && platform === 'twitch') {
        triggerProxyFallback('Proxy error. Switching to direct stream.');
        return;
      }
    }
    // Exit theater mode when stream goes offline for better offline screen visibility
    setTheaterModeActive(false);
    setPlayerError(error);
  }, [isUsingProxy, platform, triggerProxyFallback, setTheaterModeActive, reloadPlayback]);

  // Reset player error when playback changes
  useEffect(() => {
    setPlayerError(null);
  }, [playback?.url]);

  // Determine if stream is truly live - allow playback if URL exists (optimistic) or confirmed live
  // This allows the player to start buffering while metadata is still fetching
  const isStreamLive = Boolean(streamData?.startedAt);
  const effectiveStreamUrl = playback?.url || (isStreamLive && playback?.url ? playback.url : '');

  // PiP Store Integration - Track when viewing a live stream
  const { setCurrentStream, setIsOnStreamPage } = usePipStore();

  // Mark that we're on the stream page when component mounts
  // Also reset theater mode when leaving the page to restore sidebar state
  useEffect(() => {
    setIsOnStreamPage(true);
    return () => {
      // When leaving stream page, mark as not on stream page (triggers PiP if stream was active)
      setIsOnStreamPage(false);
      // Reset theater mode when leaving the page to restore sidebar to user preference
      setTheaterModeActive(false);
    };
  }, [setIsOnStreamPage, setTheaterModeActive]);

  // Match Twitch's exact theater mode chat width (measured at 1920x1080)
  useEffect(() => {
    if (isTheater) {
      setChatWidth(340); // Twitch theater mode: exactly 340px chat width
    } else {
      setChatWidth(340); // Match Twitch's standard chat width
    }
  }, [isTheater]);

  // Update PiP store with current stream info when we have a live stream
  useEffect(() => {
    if (isStreamLive && effectiveStreamUrl && channelData) {
      setCurrentStream({
        platform: platform as Platform,
        channelName: channelName,
        channelDisplayName: channelData.displayName || channelName,
        channelAvatar: channelData.avatarUrl,
        streamUrl: effectiveStreamUrl,
        title: streamData?.title,
        categoryName: streamData?.categoryName,
        viewerCount: streamData?.viewerCount,
      });
    }
  }, [
    isStreamLive,
    effectiveStreamUrl,
    platform,
    channelName,
    channelData,
    streamData,
    setCurrentStream,
  ]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
    // Disable iframe pointer events globally to prevent capturing mouse events during drag
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.userSelect = '';
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        // Min 200px, Max 600px
        if (newWidth > 200 && newWidth < 600) {
          setChatWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className={`flex-1 no-scrollbar ${isTheater ? 'flex flex-col items-center justify-center overflow-hidden py-[5px]' : 'overflow-y-auto'}`}>
          {/* Video Player Area */}
          <div className={`${isTheater ? 'h-full aspect-video max-w-full' : 'aspect-video shrink-0 w-full'} bg-black relative`}>
            {/* Platform-specific live stream players */}
            {platform === 'kick' ? (
              <KickLivePlayer
                streamUrl={effectiveStreamUrl}
                autoPlay={true}
                muted={isClipDialogOpen}
                onReady={() => console.debug('Kick Live Player ready')}
                onError={handlePlayerError}
                isTheater={isTheater}
                onToggleTheater={() => setTheaterModeActive(!isTheater)}
                startedAt={streamData?.startedAt}
              />
            ) : (
              <TwitchLivePlayer
                streamUrl={effectiveStreamUrl}
                channelName={channelName}
                autoPlay={true}
                muted={isClipDialogOpen}
                onReady={() => console.debug('Twitch Live Player ready')}
                onError={handlePlayerError}
                isTheater={isTheater}
                onToggleTheater={() => setTheaterModeActive(!isTheater)}
              />
            )}
            {/* Show loading only when fetching data */}
            {(isPlaybackLoading || isChannelLoading || isStreamLoading) && !effectiveStreamUrl && !playerError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-20 pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  {platform === 'kick' ? <KickLoadingSpinner /> : <TwitchLoadingSpinner />}
                </div>
              </div>
            )}
            {/* Proxy fallback notification toast */}
            {proxyFallbackNotice && (
              <div className="absolute bottom-4 left-4 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="bg-amber-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 max-w-md">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium">{proxyFallbackNotice}</span>
                  <button
                    onClick={() => setProxyFallbackNotice(null)}
                    className="ml-2 hover:bg-white/20 rounded p-1"
                    aria-label="Dismiss notification"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {playerError && (
              <div className="absolute inset-0 z-20 overflow-hidden">
                {/* Background: Offline banner if available, otherwise blurred avatar or gradient */}
                {channelData?.bannerUrl ? (
                  <ProxiedImage
                    src={channelData.bannerUrl}
                    alt="Offline banner"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : channelData?.avatarUrl ? (
                  <>
                    {/* Blurred, scaled-up avatar as background */}
                    <img
                      src={channelData.avatarUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-3xl scale-150 opacity-40"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 via-gray-900 to-black" />
                )}
                {/* Content overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {/* Avatar (if available and no banner) */}
                  {channelData?.avatarUrl && !channelData?.bannerUrl && (
                    <div className="mb-6">
                      <img
                        src={channelData.avatarUrl}
                        alt={channelData.displayName || channelName}
                        className="w-24 h-24 rounded-full border-4 border-white/20 shadow-2xl"
                      />
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-white text-3xl font-bold mb-2 drop-shadow-lg">
                      {channelData?.displayName || channelName}
                    </p>
                    <p className="text-white/70 text-lg mb-8">is currently offline</p>
                    <Button
                      variant="outline"
                      size="lg"
                      className="bg-white/10 border-white/30 hover:bg-white/20 backdrop-blur-sm"
                      onClick={() => { setPlayerError(null); reloadPlayback(); }}
                    >
                      Check Again
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Show offline screen when stream is confirmed offline (data loaded but not live) */}
            {!isPlaybackLoading && !isChannelLoading && !isStreamLoading && !isStreamLive && !playerError && (
              <div className="absolute inset-0 z-20 overflow-hidden">
                {/* Background: Offline banner if available, otherwise blurred avatar or gradient */}
                {channelData?.bannerUrl ? (
                  <ProxiedImage
                    src={channelData.bannerUrl}
                    alt="Offline banner"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : channelData?.avatarUrl ? (
                  <>
                    {/* Blurred, scaled-up avatar as background */}
                    <img
                      src={channelData.avatarUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-3xl scale-150 opacity-40"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 via-gray-900 to-black" />
                )}
                {/* Content overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {/* Avatar (if available and no banner) */}
                  {channelData?.avatarUrl && !channelData?.bannerUrl && (
                    <div className="mb-6">
                      <img
                        src={channelData.avatarUrl}
                        alt={channelData.displayName || channelName}
                        className="w-24 h-24 rounded-full border-4 border-white/20 shadow-2xl"
                      />
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-white text-3xl font-bold mb-2 drop-shadow-lg">
                      {channelData?.displayName || channelName}
                    </p>
                    <p className="text-white/70 text-lg mb-8">is currently offline</p>
                    <Button
                      variant="outline"
                      size="lg"
                      className="bg-white/10 border-white/30 hover:bg-white/20 backdrop-blur-sm"
                      onClick={reloadPlayback}
                    >
                      Check Again
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`${isTheater ? 'hidden' : 'block'} p-6 space-y-6`}>
            <StreamInfo
              channel={channelData || null}
              stream={streamData}
              isLoading={isChannelLoading}
            />

            <RelatedContent
              platform={platform as Platform}
              channelName={channelName}
              channelData={channelData}
              onClipSelectionChange={setIsClipDialogOpen}
            />
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      {/* We use a slightly wider invisible hit area for easier grabbing */}
      <div className="relative z-20 shrink-0">
        <div
          className="absolute inset-y-0 -left-1 w-2 cursor-ew-resize"
          onMouseDown={startResizing}
        />
        <div className="w-1 h-full bg-[var(--color-border)] hover:bg-[var(--color-primary)] transition-colors" />
      </div>

      {/* Chat Panel */}
      <div
        style={{ width: chatWidth }}
        className="bg-[var(--color-background-secondary)] flex flex-col shrink-0 relative"
      >
        <div className="p-3 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Chat</h2>
        </div>
        <div className="flex-1 p-3">
          <p className="text-[var(--color-foreground-muted)] text-sm">Chat messages will appear here</p>
        </div>
        <div className="p-3 border-t border-[var(--color-border)]">
          <input
            type="text"
            placeholder="Send a message..."
            className="w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)] text-sm focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
      </div>
    </div>
  );
}
