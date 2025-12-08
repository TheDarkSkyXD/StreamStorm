
import React from 'react';
import { useAuthInitialize } from '@/hooks/useAuth';

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
