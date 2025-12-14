/**
 * ProxiedImage Component
 * 
 * Fetches images through Electron's main process to bypass CORS restrictions.
 * Falls back to a placeholder if the image fails to load.
 */

import React, { useEffect, useState } from 'react';

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadImage() {
            // Reset state
            setLoading(true);
            setError(false);
            setImageSrc(null);



            // If no src provided, show fallback
            if (!src || src.trim() === '') {

                setLoading(false);
                setError(true);
                return;
            }

            // If it's already a data URL, use it directly
            if (src.startsWith('data:')) {

                setImageSrc(src);
                setLoading(false);
                return;
            }

            // If it's not an http(s) URL, show fallback
            if (!src.startsWith('http')) {

                setLoading(false);
                setError(true);
                return;
            }

            try {

                // Fetch through main process proxy
                const proxiedUrl = await window.electronAPI.proxyImage(src);

                if (cancelled) return;

                if (proxiedUrl) {

                    setImageSrc(proxiedUrl);
                    setLoading(false);
                } else {

                    setError(true);
                    setLoading(false);
                }
            } catch (err) {
                if (cancelled) return;

                setError(true);
                setLoading(false);
            }
        }

        loadImage();

        return () => {
            cancelled = true;
        };
    }, [src]);

    // Show fallback if loading or error
    if (loading || error || !imageSrc) {
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
            onError={() => setError(true)}
        />
    );
}
