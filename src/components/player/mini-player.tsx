
/**
 * MiniPlayer Component
 * A draggable, persistent mini-player for live streams that appears when navigating away from a stream
 */
import { useNavigate } from '@tanstack/react-router';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { LuX, LuMaximize2, LuVolume2, LuVolumeX, LuPause, LuPlay } from 'react-icons/lu';

import { HlsPlayer } from '@/components/player/hls-player';
import { TwitchHlsPlayer } from '@/components/player/twitch/twitch-hls-player';
import { PlayerError } from '@/components/player/types';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAdBlockStore } from '@/store/adblock-store';
import { usePipStore } from '@/store/pip-store';

import { useVolume } from './hooks/use-volume';

// Mini player dimensions
const MINI_PLAYER_WIDTH = 400;
const MINI_PLAYER_HEIGHT = 225;
const PADDING = 16;

export function MiniPlayer() {
    const navigate = useNavigate();
    const { currentStream, isPipActive, closePip, isOnStreamPage } = usePipStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Ad-block store setting
    const storeEnableAdBlock = useAdBlockStore((s) => s.enableAdBlock);
    
    // Determine if this is a Twitch stream that needs ad-blocking
    const isTwitchStream = currentStream?.platform === 'twitch';

    // Persistent volume
    const { isMuted, handleToggleMute, syncFromVideoElement } = useVolume({
        videoRef: videoRef as React.RefObject<HTMLVideoElement>,
        watch: currentStream?.streamUrl
    });

    // Dragging state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const positionStart = useRef({ x: 0, y: 0 });

    // Player state
    const [isPlaying, setIsPlaying] = useState(true);
    const [isHovered, setIsHovered] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Initialize position to bottom-right corner
    useEffect(() => {
        const updatePosition = () => {
            setPosition({
                x: window.innerWidth - MINI_PLAYER_WIDTH - PADDING,
                y: window.innerHeight - MINI_PLAYER_HEIGHT - PADDING - 60, // Account for title bar
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    }, []);

    // Reset error state when stream changes
    useEffect(() => {
        setHasError(false);
    }, [currentStream?.streamUrl]);

    // Dragging handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Ignore if clicking on buttons
        if ((e.target as HTMLElement).closest('button')) return;

        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        positionStart.current = { ...position };
        e.preventDefault();
    }, [position]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;

            // Calculate new position with bounds checking
            const newX = Math.max(PADDING, Math.min(
                window.innerWidth - MINI_PLAYER_WIDTH - PADDING,
                positionStart.current.x + dx
            ));
            const newY = Math.max(PADDING + 60, Math.min(
                window.innerHeight - MINI_PLAYER_HEIGHT - PADDING,
                positionStart.current.y + dy
            ));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleVolumeChange = () => syncFromVideoElement();

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
        };
    }, [isPipActive, syncFromVideoElement]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play().catch(console.error);
        } else {
            video.pause();
        }
    }, []);

    const handleExpand = useCallback(() => {
        if (!currentStream) return;

        // Navigate back to the stream page
        navigate({
            to: '/stream/$platform/$channel',
            params: {
                platform: currentStream.platform,
                channel: currentStream.channelName,
            },
            search: { tab: 'videos' },
        });
    }, [currentStream, navigate]);

    const handleError = useCallback((error: PlayerError) => {
        console.error('[MiniPlayer] Error:', error);
        setHasError(true);
        // Close PiP if stream goes offline
        if (error.code === 'STREAM_OFFLINE') {
            closePip();
        }
    }, [closePip]);

    // Don't render if not active or no stream
    if (!isPipActive || !currentStream || isOnStreamPage) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                'fixed z-50 rounded-xl overflow-hidden shadow-2xl',
                'bg-black border border-[var(--color-border)]',
                'transition-shadow duration-200',
                isDragging ? 'cursor-grabbing shadow-3xl' : 'cursor-grab',
                isHovered && 'ring-2 ring-white/30'
            )}
            style={{
                width: MINI_PLAYER_WIDTH,
                height: MINI_PLAYER_HEIGHT,
                left: position.x,
                top: position.y,
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Video Player - Use TwitchHlsPlayer for Twitch (ad-blocking), HlsPlayer for others */}
            {!hasError && currentStream.streamUrl && (
                isTwitchStream ? (
                    <TwitchHlsPlayer
                        ref={videoRef}
                        src={currentStream.streamUrl}
                        channelName={currentStream.channelName}
                        enableAdBlock={storeEnableAdBlock}
                        muted={isMuted}
                        autoPlay={true}
                        currentLevel="auto"
                        onError={handleError}
                        className="w-full h-full object-contain"
                        controls={false}
                    />
                ) : (
                    <HlsPlayer
                        ref={videoRef}
                        src={currentStream.streamUrl}
                        muted={isMuted}
                        autoPlay={true}
                        currentLevel="auto"
                        onError={handleError}
                        className="w-full h-full object-contain"
                        controls={false}
                    />
                )
            )}

            {/* Error State */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <p className="text-white/70 text-sm">Stream unavailable</p>
                </div>
            )}

            {/* Controls Overlay */}
            <div
                className={cn(
                    'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50',
                    'transition-opacity duration-200',
                    isHovered ? 'opacity-100' : 'opacity-0'
                )}
            >
                {/* Top Bar - Close & Expand */}
                <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        {/* Live indicator */}
                        <span className="flex items-center gap-1.5 bg-red-600 px-2 py-0.5 rounded text-xs font-bold text-white">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            LIVE
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleExpand}
                                    className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                                >
                                    <LuMaximize2 size={16} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent container={containerRef.current}>
                                Expand
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={closePip}
                                    className="p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors"
                                >
                                    <LuX size={16} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent container={containerRef.current}>
                                Close
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Bottom Bar - Stream Info & Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                    {/* Stream Info */}
                    <div className="flex items-center gap-2 mb-2">
                        {currentStream.channelAvatar && (
                            <img
                                src={currentStream.channelAvatar}
                                alt={currentStream.channelDisplayName}
                                className="w-6 h-6 rounded-full"
                            />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">
                                {currentStream.channelDisplayName}
                            </p>
                            {currentStream.categoryName && (
                                <p className="text-white/60 text-xs truncate">
                                    {currentStream.categoryName}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={togglePlay}
                                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                                    >
                                        {isPlaying ? <LuPause size={16} /> : <LuPlay size={16} />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent container={containerRef.current}>
                                    {isPlaying ? 'LuPause' : 'LuPlay'}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={handleToggleMute}
                                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                                    >
                                        {isMuted ? <LuVolumeX size={16} /> : <LuVolume2 size={16} />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent container={containerRef.current}>
                                    {isMuted ? 'Unmute' : 'Mute'}
                                </TooltipContent>
                            </Tooltip>
                        </div>

                        {/* Viewer count */}
                        {currentStream.viewerCount !== undefined && (
                            <span className="text-white/60 text-xs">
                                {currentStream.viewerCount.toLocaleString()} viewers
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
