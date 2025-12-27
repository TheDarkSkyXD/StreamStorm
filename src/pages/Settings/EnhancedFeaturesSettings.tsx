import { Sparkles, Eye, Monitor, Film, Info, EyeOff, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    EnhancedFeaturesPreferences,
    DEFAULT_ENHANCED_FEATURES_PREFERENCES,
    DEFAULT_ADVANCED_PREFERENCES,
} from '@/shared/auth-types';

export function EnhancedFeaturesSettings() {
    const preferences = useAuthStore(state => state.preferences);
    const updatePreferences = useAuthStore(state => state.updatePreferences);

    // Get current config with fallbacks
    const enhancedConfig = preferences?.advanced?.enhancedFeatures ?? DEFAULT_ENHANCED_FEATURES_PREFERENCES;
    const adBlockEnabled = preferences?.advanced?.adBlock?.enabled ?? false;

    const updateEnhancedConfig = async (updates: Partial<EnhancedFeaturesPreferences>) => {
        const currentAdvanced = preferences?.advanced || DEFAULT_ADVANCED_PREFERENCES;

        await updatePreferences({
            advanced: {
                ...currentAdvanced,
                enhancedFeatures: {
                    ...enhancedConfig,
                    ...updates
                }
            }
        });
    };

    const handleToggleVisibilitySpoof = async (enabled: boolean) => {
        await updateEnhancedConfig({ visibilitySpoofing: enabled });
    };

    const handleToggleForceAvc = async (enabled: boolean) => {
        await updateEnhancedConfig({ forceAvcCodec: enabled });
    };

    const handleToggleAdStripping = async (enabled: boolean) => {
        await updateEnhancedConfig({ adSegmentStripping: enabled });
    };

    const handleStrippingModeChange = async (mode: 'placeholder' | 'skip') => {
        await updateEnhancedConfig({ adStrippingMode: mode });
    };

    return (
        <Card className="border-[var(--color-border)]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Enhanced Features
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-normal">
                        Phase 4
                    </span>
                </CardTitle>
                <CardDescription>
                    Advanced playback and ad-blocking optimizations based on VAFT.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Visibility Spoofing */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-base flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-400" />
                            Background Playback
                        </Label>
                        <p className="text-sm text-[var(--color-foreground-secondary)]">
                            Continue playing when window loses focus (PiP, multi-monitor)
                        </p>
                    </div>
                    <Switch
                        checked={enhancedConfig.visibilitySpoofing}
                        onCheckedChange={handleToggleVisibilitySpoof}
                        className="data-[state=checked]:bg-blue-500 [&_span]:bg-white"
                    />
                </div>

                {enhancedConfig.visibilitySpoofing && (
                    <div className="flex items-start gap-2 text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 p-3 rounded-md ml-6 animate-in fade-in slide-in-from-top-2 duration-200">
                        <EyeOff className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>
                            Visibility spoofing is active. The player will continue playing even when
                            you switch to other windows or minimize the app.
                        </p>
                    </div>
                )}

                {/* Force AVC Codec */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-base flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-green-400" />
                            Force AVC Codec
                        </Label>
                        <p className="text-sm text-[var(--color-foreground-secondary)]">
                            Use H.264 instead of HEVC for better browser compatibility
                        </p>
                    </div>
                    <Switch
                        checked={enhancedConfig.forceAvcCodec}
                        onCheckedChange={handleToggleForceAvc}
                        className="data-[state=checked]:bg-green-500 [&_span]:bg-white"
                    />
                </div>

                {enhancedConfig.forceAvcCodec && (
                    <div className="flex items-start gap-2 text-xs text-gray-400 bg-green-500/10 border border-green-500/20 p-3 rounded-md ml-6 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Monitor className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                        <p>
                            HEVC (H.265) streams will be swapped to AVC (H.264) for compatibility.
                            This may affect 2K/4K stream quality on browsers that support HEVC.
                        </p>
                    </div>
                )}

                {/* Ad Segment Stripping */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-base flex items-center gap-2">
                            <Film className="w-4 h-4 text-yellow-400" />
                            Ad Segment Stripping
                            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full font-normal">
                                Experimental
                            </span>
                        </Label>
                        <p className="text-sm text-[var(--color-foreground-secondary)]">
                            Replace ad segments with placeholder (more aggressive blocking)
                        </p>
                    </div>
                    <Switch
                        checked={enhancedConfig.adSegmentStripping}
                        onCheckedChange={handleToggleAdStripping}
                        disabled={!adBlockEnabled}
                        className="data-[state=checked]:bg-yellow-500 [&_span]:bg-white"
                    />
                </div>

                {!adBlockEnabled && enhancedConfig.adSegmentStripping && (
                    <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md ml-6">
                        <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                            Enable Twitch Ad-Block to use this feature.
                        </p>
                    </div>
                )}

                {enhancedConfig.adSegmentStripping && adBlockEnabled && (
                    <div className="space-y-3 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Stripping Mode Selector */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                            <div className="space-y-0.5">
                                <Label className="text-sm">Stripping Mode</Label>
                                <p className="text-xs text-gray-400">
                                    How to handle ad segments in the playlist
                                </p>
                            </div>
                            <Select
                                value={enhancedConfig.adStrippingMode}
                                onValueChange={(v) => handleStrippingModeChange(v as 'placeholder' | 'skip')}
                            >
                                <SelectTrigger className="w-32 h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="placeholder">Placeholder</SelectItem>
                                    <SelectItem value="skip">Skip</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Mode description */}
                        <div className="bg-[var(--color-background-secondary)] rounded-lg p-3 text-xs text-gray-400">
                            {enhancedConfig.adStrippingMode === 'placeholder' ? (
                                <p>
                                    <strong className="text-gray-300">Placeholder mode:</strong> Ad segments are replaced
                                    with a tiny black/silent video. This preserves playlist timing and prevents issues
                                    with live stream synchronization.
                                </p>
                            ) : (
                                <p>
                                    <strong className="text-gray-300">Skip mode:</strong> Ad segments are completely
                                    removed from the playlist. This may cause brief timing jumps but results in
                                    smoother transitions.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Info box */}
                <div className="flex items-start gap-2 text-xs text-gray-400 bg-purple-500/10 border border-purple-500/20 p-3 rounded-md mt-4">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                    <p>
                        These are advanced features from the VAFT Phase 4 implementation.
                        They provide additional playback optimizations and ad-blocking capabilities
                        beyond the core functionality.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
