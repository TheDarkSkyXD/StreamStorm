/**
 * ProxiedImage Component
 * 
 * Fetches images through Electron's main process to bypass CORS restrictions.
 * Shows skeleton loading while fetching URL, falls back to a placeholder if the image fails to load.
 */

import React, { useEffect, useState } from 'react';
import { Skeleton } from './skeleton';

// Domains that require IPC proxying (image fetched in main process, returned as base64)
//
// Kick CDN domains require the IPC proxy because:
// 1. files.kick.com and images.kick.com have strict hotlinking protection
// 2. Electron's request interceptor (onBeforeSendHeaders) doesn't reliably set Referer headers
// 3. The IPC proxy uses Electron's net.request which can set headers properly
//
// Kick image URL patterns:
// - files.kick.com: Profile pictures, emotes, banners (legacy)
// - images.kick.com: Thumbnails, video previews
// - kick.com/img/: Official API profile pictures
//
// @see src/backend/ipc/handlers/system-handlers.ts
const PROXY_REQUIRED_DOMAINS: string[] = [
    'files.kick.com',
    'images.kick.com',
];

// Additional URL patterns that require proxying (checked against full URL)
const PROXY_REQUIRED_PATTERNS: RegExp[] = [
    /^https?:\/\/(www\.)?kick\.com\/img\//i,  // kick.com/img/... URLs from official API
];

/**
 * Check if a URL requires proxying
 */
function needsProxy(url: string): boolean {
    try {
        const parsed = new URL(url);
        
        // Check against domain list
        const domainMatch = PROXY_REQUIRED_DOMAINS.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
        if (domainMatch) return true;
        
        // Check against URL pattern list
        const patternMatch = PROXY_REQUIRED_PATTERNS.some(pattern =>
            pattern.test(url)
        );
        if (patternMatch) return true;
        
        return false;
    } catch {
        return false;
    }
}

interface ProxiedImageProps {
    src: string | undefined | null;
    alt: string;
    className?: string;
    fallback?: React.ReactNode;
    fallbackClassName?: string;
    /** Optional class name for the skeleton loader. Defaults to className if not provided. */
    skeletonClassName?: string;
}

export function ProxiedImage({
    src,
    alt,
    className = '',
    fallback,
    fallbackClassName = '',
    skeletonClassName
}: ProxiedImageProps) {
    // The resolved image source (either direct URL or proxied data URL)
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    // Whether we're currently resolving/fetching the image URL
    const [isResolving, setIsResolving] = useState(true);
    // Whether there was an error (no src, invalid URL, or failed to proxy/load)
    const [hasError, setHasError] = useState(false);
    // Whether to show skeleton (delayed to avoid flash for instant resolution)
    const [showSkeleton, setShowSkeleton] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

        async function resolveImageSrc() {
            setIsResolving(true);
            setHasError(false);
            setResolvedSrc(null);
            setShowSkeleton(false);

            // Show skeleton after 100ms delay (avoids flash for instant loads)
            skeletonTimer = setTimeout(() => {
                if (!cancelled) {
                    setShowSkeleton(true);
                }
            }, 100);

            // If no src provided, show fallback
            if (!src || src.trim() === '') {
                setIsResolving(false);
                setHasError(true);
                return;
            }

            // If it's already a data URL, use it directly
            if (src.startsWith('data:')) {
                if (!cancelled) {
                    setResolvedSrc(src);
                    setIsResolving(false);
                }
                return;
            }

            // If it's not an http(s) URL, show fallback
            if (!src.startsWith('http')) {
                setIsResolving(false);
                setHasError(true);
                return;
            }

            // If the URL doesn't need proxying, use it directly
            if (!needsProxy(src)) {
                if (!cancelled) {
                    setResolvedSrc(src);
                    setIsResolving(false);
                }
                return;
            }

            // URL needs to be proxied through Electron
            try {
                if (!window.electronAPI?.proxyImage) {
                    throw new Error('Electron API not available');
                }

                const proxiedUrl = await window.electronAPI.proxyImage(src);

                if (cancelled) return;

                if (proxiedUrl) {
                    setResolvedSrc(proxiedUrl);
                } else {
                    setHasError(true);
                }
            } catch (error) {
                if (cancelled) return;
                console.error('[ProxiedImage] Failed to proxy image:', error);
                setHasError(true);
            } finally {
                if (!cancelled) {
                    setIsResolving(false);
                }
            }
        }

        resolveImageSrc();

        return () => {
            cancelled = true;
            if (skeletonTimer) {
                clearTimeout(skeletonTimer);
            }
        };
    }, [src]);

    // Handle img element error (image failed to load after we had the URL)
    const handleImgError = () => {
        setHasError(true);
    };

    // Show fallback when there's an error (image unavailable)
    if (hasError) {
        if (fallback) {
            return <>{fallback}</>;
        }
        // Default fallback: first letter of alt text
        const initial = alt ? alt.charAt(0).toUpperCase() : '?';
        return (
            <div className={`flex items-center justify-center bg-secondary text-lg font-bold ${fallbackClassName || className}`}>
                {initial}
            </div>
        );
    }

    // Show skeleton while resolving URL (only after 100ms delay)
    if (isResolving) {
        if (showSkeleton) {
            return <Skeleton className={skeletonClassName || className} />;
        }
        // Before 100ms delay, render nothing to avoid flash
        return null;
    }

    // We have the resolved URL - render the image directly
    // The browser will handle caching and loading animation natively
    if (resolvedSrc) {
        return (
            <img
                src={resolvedSrc}
                alt={alt}
                className={className}
                onError={handleImgError}
            />
        );
    }

    // Fallback case (shouldn't normally reach here)
    return null;
}

