
import React from 'react';

import { useAuthInitialize } from '@/hooks/useAuth';
import { useFollowStore } from '@/store/follow-store';

interface AuthProviderProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * AuthProvider
 *
 * Initializes the authentication state when the application starts.
 * Shows a fallback (loading state) until initialization is complete.
 */
export function AuthProvider({ children, fallback }: AuthProviderProps) {
    const initialized = useAuthInitialize();
    const hydrateFollows = useFollowStore(state => state.hydrate);

    React.useEffect(() => {
        if (initialized && hydrateFollows) {
            hydrateFollows();
        }
    }, [initialized, hydrateFollows]);

    if (!initialized) {
        if (fallback) {
            return <>{fallback}</>;
        }
        // Default fallback: empty or simple spinner could go here
        // For now, we'll return null to prevent flickering uninitialized state
        return null;
    }

    return <>{children}</>;
}
