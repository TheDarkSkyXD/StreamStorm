
import { useParams } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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

export function StreamPage() {
  const { platform, channel: channelName } = useParams({ from: '/_app/stream/$platform/$channel' });

  // Playback URL resolution
  const {
    playback,
    isLoading: isPlaybackLoading,
    reload: reloadPlayback
  } = useStreamPlayback(platform as Platform, channelName);

  // Real data fetching
  const { data: channelData, isLoading: isChannelLoading } = useChannelByUsername(channelName, platform as Platform);
  const { data: streamData, isLoading: isStreamLoading } = useStreamByChannel(channelName, platform as Platform);

  // Chat Resizing Logic
  const [chatWidth, setChatWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);

  // Theater Mode Logic
  const [isTheater, setIsTheater] = useState(false);

  // Player error state (e.g., stream offline even though URL was provided)
  const [playerError, setPlayerError] = useState<PlayerError | null>(null);

  // Track clip dialog state to mute main player
  const [isClipDialogOpen, setIsClipDialogOpen] = useState(false);

  const handlePlayerError = useCallback((error: PlayerError) => {
    // STREAM_OFFLINE is expected when a stream ends - use debug logging
    if (error.code === 'STREAM_OFFLINE') {
      console.debug('Stream ended or went offline');
    } else {
      console.error('Player error', error);
    }
    setPlayerError(error);
  }, []);

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
  useEffect(() => {
    setIsOnStreamPage(true);
    return () => {
      // When leaving stream page, mark as not on stream page (triggers PiP if stream was active)
      setIsOnStreamPage(false);
    };
  }, [setIsOnStreamPage]);

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
        // Min 300px, Max 600px
        if (newWidth > 300 && newWidth < 600) {
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
        <div className={`flex-1 overflow-y-auto no-scrollbar ${isTheater ? 'flex flex-col' : ''}`}>
          {/* Video Player Area */}
          <div className={`${isTheater ? 'flex-1 min-h-0' : 'aspect-video'} bg-black flex items-center justify-center shrink-0 w-full relative transition-all duration-300`}>
            {/* Platform-specific live stream players */}
            {platform === 'kick' ? (
              <KickLivePlayer
                streamUrl={effectiveStreamUrl}
                autoPlay={true}
                muted={isClipDialogOpen}
                onReady={() => console.log('Kick Live Player ready')}
                onError={handlePlayerError}
                isTheater={isTheater}
                onToggleTheater={() => setIsTheater(prev => !prev)}
                startedAt={streamData?.startedAt}
              />
            ) : (
              <TwitchLivePlayer
                streamUrl={effectiveStreamUrl}
                autoPlay={true}
                muted={isClipDialogOpen}
                onReady={() => console.log('Twitch Live Player ready')}
                onError={handlePlayerError}
                isTheater={isTheater}
                onToggleTheater={() => setIsTheater(prev => !prev)}
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
            {playerError && (
              <div className="absolute inset-0 z-20 overflow-hidden">
                {/* Background: Offline banner if available, otherwise blurred avatar or gradient */}
                {channelData?.bannerUrl ? (
                  <img
                    src={channelData.bannerUrl}
                    alt=""
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
                  <img
                    src={channelData.bannerUrl}
                    alt=""
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
