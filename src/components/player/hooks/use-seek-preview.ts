import Hls from 'hls.js';
import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseSeekPreviewProps {
    streamUrl: string | null;
    thumbnail?: string;
}

export function useSeekPreview({ streamUrl, thumbnail }: UseSeekPreviewProps) {
    const [previewImage, setPreviewImage] = useState<string | undefined>(thumbnail);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize hidden elements once
    useEffect(() => {
        if (!videoRef.current) {
            const v = document.createElement('video');
            v.muted = true;
            v.playsInline = true;
            v.crossOrigin = 'anonymous'; // Important for canvas
            v.preload = 'auto';
            videoRef.current = v;
        }
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            videoRef.current = null;
            canvasRef.current = null;
            if (seekTimeoutRef.current) {
                clearTimeout(seekTimeoutRef.current);
            }
        };
    }, []);

    // Helper to extract frame
    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Set canvas to a reasonable preview size (e.g. 320px width)
        // A smaller size is faster and sufficient for preview
        const width = 320;
        const aspect = (video.videoWidth && video.videoHeight)
            ? video.videoWidth / video.videoHeight
            : 16 / 9;
        const height = width / aspect;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 0.6 quality is enough
                setPreviewImage(dataUrl);
            } catch (e) {
                console.warn("[SeekPreview] Canvas tainted or error", e);
            }
        }
    }, []);

    // Listen to seeked event
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.addEventListener('seeked', captureFrame);
        return () => video.removeEventListener('seeked', captureFrame);
    }, [captureFrame]);

    // Initialize HLS for the preview video when streamUrl changes
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        // Clean up previous HLS
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('usher.ttvnw.net');

        if (isHls && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                // Optimize for low resource usage
                maxBufferLength: 5, // Keep buffer small
                maxMaxBufferLength: 10,
                maxBufferHole: 0.5,
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                // Force lowest quality level for faster seeking and lower bandwidth
                if (data.levels.length > 0) {
                    // Find level with ~360p or lowest
                    // Just use 0 (usually lowest) or index of lowest bitrate
                    // Sorting levels by bitrate/height might be safer, but levels[0] is often lowest in HLS.js sort? 
                    // Actually HLS.js levels are usually sorted lowest to highest or as in manifest.
                    // We'll trust level 0 is efficient enough or iterate to find lowest height.
                    let lowestLevel = 0;
                    let minHeight = Infinity;

                    data.levels.forEach((level, index) => {
                        if (level.height && level.height < minHeight) {
                            minHeight = level.height;
                            lowestLevel = index;
                        }
                    });

                    hls.currentLevel = lowestLevel;
                    console.debug('[SeekPreview] Using quality level:', lowestLevel, 'height:', minHeight);
                }
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.warn('[SeekPreview] Fatal HLS error:', data.type, data.details);
                    if (thumbnail) setPreviewImage(thumbnail);
                }
            });

            hlsRef.current = hls;
        } else {
            // Standard playback
            video.src = streamUrl;
        }
    }, [streamUrl]);


    const handleSeekHover = useCallback((time: number | null) => {
        if (time === null) {
            setPreviewImage(undefined);
            return;
        }

        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

        seekTimeoutRef.current = setTimeout(() => {
            const video = videoRef.current;
            if (!video || !streamUrl) {
                if (thumbnail) setPreviewImage(thumbnail);
                return;
            }

            // Seek
            if (Number.isFinite(time)) {
                // If the time is very distinct from current, seek. 
                // We don't check currentTime here because we want precise frames.
                video.currentTime = time;
            }
        }, 150); // 150ms debounce
    }, [streamUrl, thumbnail]);

    return { previewImage, handleSeekHover };
}
