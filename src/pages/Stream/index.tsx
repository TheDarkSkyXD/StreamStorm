
import { useParams } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useChannelByUsername } from '@/hooks/queries/useChannels';
import { useStreamByChannel } from '@/hooks/queries/useStreams';
import { Platform } from '@/shared/auth-types';
import { VideoPlayer } from '@/components/player';
import { useStreamPlayback } from '@/hooks/useStreamPlayback';
import { StreamInfo } from '@/components/stream/stream-info';
import { RelatedContent } from '@/components/stream/related-content';

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
  const { data: streamData } = useStreamByChannel(channelName, platform as Platform);

  // Chat Resizing Logic
  const [chatWidth, setChatWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);

  // Theater Mode Logic
  const [isTheater, setIsTheater] = useState(false);

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
        <div className={`flex-1 overflow-y-auto ${isTheater ? 'flex flex-col' : ''}`}>
          {/* Video Player Area */}
          <div className={`${isTheater ? 'flex-1 min-h-0' : 'aspect-video'} bg-black flex items-center justify-center shrink-0 w-full relative transition-all duration-300`}>
            <VideoPlayer
              streamUrl={playback?.url || ''}
              platform={platform as Platform}
              autoPlay={true}
              muted={false}
              onReady={() => console.log('Player ready')}
              onError={(e) => console.error('Player error', e)}
              isTheater={isTheater}
              onToggleTheater={() => setIsTheater(prev => !prev)}
            />
            {isPlaybackLoading && !playback && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
                <span className="text-white text-sm">Loading stream...</span>
              </div>
            )}
            {!isPlaybackLoading && !playback && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                <div className="text-center">
                  <p className="text-white mb-2">Stream offline or unavailable</p>
                  <Button variant="outline" size="sm" onClick={reloadPlayback}>Retry</Button>
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
