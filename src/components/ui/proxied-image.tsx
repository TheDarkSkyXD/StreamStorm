/**
 * ProxiedImage Component
 * 
 * Fetches images through Electron's main process to bypass CORS restrictions.
 * Falls back to a placeholder if the image fails to load.
 */

import React, { useEffect, useState } from 'react';

// Domains that require proxying due to hotlinking or CORS restrictions
const PROXY_REQUIRED_DOMAINS = [
    'files.kick.com',
    'images.kick.com',
];

/**
 * Check if a URL requires proxying
 */
function needsProxy(url: string): boolean {
    try {
        const parsed = new URL(url);
        return PROXY_REQUIRED_DOMAINS.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
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
}

export function ProxiedImage({
    src,
    alt,
    className = '',
    fallback,
    fallbackClassName = ''
}: ProxiedImageProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadImage() {
            setIsLoading(true);
            setHasError(false);
            setImageSrc(null);

            // If no src provided, show fallback
            if (!src || src.trim() === '') {
                setIsLoading(false);
                setHasError(true);
                return;
            }

            // If it's already a data URL, use it directly
            if (src.startsWith('data:')) {
                setImageSrc(src);
                setIsLoading(false);
                return;
            }

            // If it's not an http(s) URL, show fallback
            if (!src.startsWith('http')) {
                setIsLoading(false);
                setHasError(true);
                return;
            }

            // If the URL doesn't need proxying, use it directly
            if (!needsProxy(src)) {
                setImageSrc(src);
                setIsLoading(false);
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
                    setImageSrc(proxiedUrl);
                } else {
                    setHasError(true);
                }
            } catch (error) {
                if (cancelled) return;
                console.error('[ProxiedImage] Failed to proxy image:', error);
                setHasError(true);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadImage();

        return () => {
            cancelled = true;
        };
    }, [src]);

    // Show fallback if loading or error
    if (isLoading || hasError || !imageSrc) {
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

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            onError={() => setHasError(true)}
        />
    );
}
