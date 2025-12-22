import { Shield, Loader2, Check, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth-store';
import {
    ProxyServerId,
    isValidProxyUrl,
    DEFAULT_STREAM_PROXY_CONFIG,
} from '@/shared/proxy-types';

export function TwitchProxySettings() {
    const preferences = useAuthStore(state => state.preferences);
    const updatePreferences = useAuthStore(state => state.updatePreferences);

    // Ref for debouncing custom URL saves
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const preferencesRef = useRef(preferences);

    useEffect(() => {
        preferencesRef.current = preferences;
    }, [preferences]);

    // Local state for custom URL input (allows real-time typing without immediate persistence)
    const [localCustomUrl, setLocalCustomUrl] = useState(
        preferences?.advanced?.streamProxy?.customProxyUrl || ''
    );

    // State for test results
    const [testResult, setTestResult] = useState<{
        status: 'idle' | 'testing' | 'success' | 'failed';
        latencyMs?: number;
        error?: string;
    }>({ status: 'idle' });

    // State for custom URL validation errors
    const [customUrlError, setCustomUrlError] = useState<string | null>(null);

    // Sync local custom URL when preferences change
    useEffect(() => {
        setLocalCustomUrl(preferences?.advanced?.streamProxy?.customProxyUrl || '');
    }, [preferences?.advanced?.streamProxy?.customProxyUrl]);

    // Get current proxy config with safe defaults
    const currentProxyConfig = preferences?.advanced?.streamProxy ?? DEFAULT_STREAM_PROXY_CONFIG;

    const handleProxyChange = async (proxyId: string) => {
        const id = proxyId as ProxyServerId;
        await updatePreferences({
            advanced: {
                ...preferences?.advanced!,
                streamProxy: {
                    ...currentProxyConfig,
                    selectedProxy: id,
                },
            },
        });
    };

    const validateCustomUrl = (url: string) => {
        const trimmed = url.trim();

        // Empty URL is valid (clears custom proxy)
        if (!trimmed) {
            setCustomUrlError(null);
            return;
        }

        // Use shared validation helper for consistency with backend
        const validation = isValidProxyUrl(trimmed);
        if (!validation.valid) {
            setCustomUrlError(validation.error || 'Invalid URL');
        } else {
            setCustomUrlError(null);
        }
    };

    const handleCustomUrlChange = (url: string) => {
        // Update local state immediately for responsive UI
        setLocalCustomUrl(url);

        // Validate immediately for real-time feedback
        validateCustomUrl(url);

        // Clear any pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce the save to avoid persisting while user is still typing
        saveTimeoutRef.current = setTimeout(async () => {
            const trimmed = url.trim();

            // Don't save invalid URLs (except empty, which clears the custom URL)
            if (trimmed) {
                const validation = isValidProxyUrl(trimmed);
                if (!validation.valid) {
                    return; // Don't persist invalid URLs
                }
            }

            const latestPreferences = preferencesRef.current;
            const latestProxyConfig = latestPreferences?.advanced?.streamProxy ?? DEFAULT_STREAM_PROXY_CONFIG;

            await updatePreferences({
                advanced: {
                    ...latestPreferences?.advanced!,
                    streamProxy: {
                        ...latestProxyConfig,
                        customProxyUrl: trimmed, // Save trimmed or empty
                    },
                },
            });
        }, 500); // Debounce 500ms
    };

    const handleFallbackChange = async (enabled: boolean) => {
        await updatePreferences({
            advanced: {
                ...preferences?.advanced!,
                streamProxy: {
                    ...currentProxyConfig,
                    fallbackToDirect: enabled,
                },
            },
        });
    };

    const handleTestProxy = async () => {
        setTestResult({ status: 'testing' });

        try {
            // Use IPC to test connection from main process (bypasses CSP)
            const response = await window.electronAPI.proxy.testConnection(currentProxyConfig);

            if (response.success) {
                setTestResult({
                    status: 'success',
                    latencyMs: response.latencyMs,
                });
            } else {
                setTestResult({
                    status: 'failed',
                    error: response.error || 'Unknown error',
                });
            }
        } catch (error) {
            setTestResult({
                status: 'failed',
                error: error instanceof Error ? error.message : 'Test failed',
            });
        }

        // Clear result after 5 seconds
        setTimeout(() => setTestResult({ status: 'idle' }), 5000);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-400" />
                    Stream Proxy (Twitch)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Proxy Server Selection */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Ad-Block Proxy</p>
                        <p className="text-sm text-[var(--color-foreground-secondary)]">
                            Route Twitch streams through ad-blocking proxy
                        </p>
                    </div>
                    <Select
                        value={currentProxyConfig.selectedProxy}
                        onValueChange={handleProxyChange}
                    >
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Select proxy server" />
                        </SelectTrigger>
                        <SelectContent>
                            {/* Disabled */}
                            <SelectItem value="none">Disabled</SelectItem>

                            {/* TTV LOL PRO Group - CURRENTLY OFFLINE/UNRELIABLE
              <div className="px-2 py-1.5 text-xs font-medium text-[var(--color-foreground-muted)] border-t mt-1 pt-2">
                TTV LOL PRO
              </div>
              <SelectItem value="ttv-lol-eu">EU</SelectItem>
              <SelectItem value="ttv-lol-eu2">EU 2</SelectItem>
              <SelectItem value="ttv-lol-eu3">EU 3</SelectItem>
              <SelectItem value="ttv-lol-eu4">EU 4</SelectItem>
              <SelectItem value="ttv-lol-eu5">EU 5</SelectItem>
              <SelectItem value="ttv-lol-na">North America</SelectItem>
              <SelectItem value="ttv-lol-as">Asia</SelectItem>
              <SelectItem value="ttv-lol-sa">South America</SelectItem>
              */}

                            {/* Luminous Group - CURRENTLY OFFLINE/UNRELIABLE
              <div className="px-2 py-1.5 text-xs font-medium text-[var(--color-foreground-muted)] border-t mt-1 pt-2">
                Luminous
              </div>
              <SelectItem value="luminous-eu">EU</SelectItem>
              <SelectItem value="luminous-eu2">EU 2</SelectItem>
              <SelectItem value="luminous-as">Asia</SelectItem>
              */}

                            {/* Custom */}
                            <div className="px-2 py-1.5 text-xs font-medium text-[var(--color-foreground-muted)] border-t mt-1 pt-2">
                                Other
                            </div>
                            <SelectItem value="custom">Custom Proxy</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Custom Proxy URL Input */}
                {currentProxyConfig.selectedProxy === 'custom' && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Custom Proxy URL</label>
                        <input
                            type="url"
                            placeholder="https://my-proxy.com"
                            value={localCustomUrl}
                            onChange={(e) => handleCustomUrlChange(e.target.value)}
                            className={`w-full px-3 py-2 rounded-md border bg-[var(--color-background)] 
                focus:outline-none focus:ring-2 focus:ring-purple-500/50
                ${customUrlError ? 'border-red-400' : 'border-[var(--color-border)]'}`}
                        />
                        <div className="text-xs space-y-1 text-[var(--color-foreground-muted)]">
                            <p>• Must be a valid HTTPS URL (e.g., https://my-proxy.com)</p>
                            <p>• Do NOT include /playlist path</p>
                        </div>
                        {customUrlError && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                                <X className="w-3 h-3" />
                                {customUrlError}
                            </p>
                        )}
                    </div>
                )}

                {/* Fallback Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Fallback to Direct</p>
                        <p className="text-sm text-[var(--color-foreground-secondary)]">
                            Use regular stream if proxy fails (may show ads)
                        </p>
                    </div>
                    <button
                        onClick={() => handleFallbackChange(!currentProxyConfig.fallbackToDirect)}
                        className={`relative w-11 h-6 rounded-full transition-colors
              ${currentProxyConfig.fallbackToDirect
                                ? 'bg-purple-500'
                                : 'bg-[var(--color-border)]'}`}
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform
                ${currentProxyConfig.fallbackToDirect ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>

                {/* Test Connection Button */}
                <div className="space-y-2">
                    <Button
                        variant="outline"
                        onClick={handleTestProxy}
                        disabled={currentProxyConfig.selectedProxy === 'none' || testResult.status === 'testing'}
                        className="w-full sm:w-auto"
                    >
                        {testResult.status === 'testing' ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Testing...
                            </>
                        ) : (
                            'Test Proxy Connection'
                        )}
                    </Button>

                    {testResult.status === 'success' && (
                        <p className="text-sm text-green-400 flex items-center gap-1.5">
                            <Check className="w-4 h-4" />
                            Proxy reachable ({testResult.latencyMs}ms latency)
                        </p>
                    )}
                    {testResult.status === 'failed' && (
                        <p className="text-sm text-red-400 flex items-center gap-1.5">
                            <X className="w-4 h-4" />
                            {testResult.error}
                        </p>
                    )}
                </div>

                {/* Info Note */}
                <p className="text-xs text-[var(--color-foreground-muted)] pt-2 border-t border-[var(--color-border)]">
                    Proxy servers route HLS manifest requests to bypass Twitch ads.
                    Video segments are still fetched directly from Twitch CDN.
                </p>
            </CardContent>
        </Card>
    );
}
