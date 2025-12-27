import { Shield, Zap, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    AdBlockPreferences,
    DEFAULT_ADBLOCK_PREFERENCES
} from '@/shared/auth-types';
import { VAFT_BACKUP_PLAYER_TYPES } from '@/shared/adblock-types';

export function TwitchAdBlockSettings() {
    const preferences = useAuthStore(state => state.preferences);
    const updatePreferences = useAuthStore(state => state.updatePreferences);

    // Get current config with fallbacks
    const adBlockConfig = preferences?.advanced?.adBlock ?? DEFAULT_ADBLOCK_PREFERENCES;
    const isProxyEnabled = preferences?.advanced?.streamProxy?.selectedProxy !== 'none';

    const updateAdBlockConfig = async (updates: Partial<AdBlockPreferences>) => {
        const currentAdvanced = preferences?.advanced || {
            enableImageProxy: true,
            streamProxy: { selectedProxy: 'none', fallbackToDirect: true } as const,
            adBlock: DEFAULT_ADBLOCK_PREFERENCES,
            bufferingRecovery: { enabled: true, sensitivity: 'medium' as const, showNotification: false },
            enhancedFeatures: { visibilitySpoofing: false, forceAvcCodec: false, adSegmentStripping: false, adStrippingMode: 'placeholder' as const }
        };

        await updatePreferences({
            advanced: {
                ...currentAdvanced,
                adBlock: {
                    ...adBlockConfig,
                    ...updates
                }
            }
        });
    };

    const handleToggleEnabled = async (enabled: boolean) => {
        await updateAdBlockConfig({ enabled });
    };

    const handleToggleHideAds = async (hide: boolean) => {
        await updateAdBlockConfig({ hideAdsDuringPlayback: hide });
    };

    // Format backup player types for display
    const backupTypesDisplay = VAFT_BACKUP_PLAYER_TYPES
        .map(t => t.playerType)
        .join(' → ');

    return (
        <Card className="border-[var(--color-border)]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Twitch Ad-Block
                </CardTitle>
                <CardDescription>
                    Block ads using TwitchAdSolutions VAFT method. No configuration needed.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Master Switch */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-base">Enable Ad-Block</Label>
                        <p className="text-sm text-[var(--color-foreground-secondary)]">
                            Automatically blocks pre-roll and mid-roll ads
                        </p>
                    </div>
                    <Switch
                        checked={adBlockConfig.enabled}
                        onCheckedChange={handleToggleEnabled}
                        className="data-[state=checked]:bg-purple-500 [&_span]:bg-white"
                    />
                </div>

                {isProxyEnabled && adBlockConfig.enabled && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-200/90">
                            <strong>Note:</strong> Stream Proxy is also enabled. Native Ad-Block will take precedence.
                            It is recommended to disable the proxy if using this feature.
                        </div>
                    </div>
                )}

                {adBlockConfig.enabled && (
                    <div className="space-y-4 pt-4 border-t border-[var(--color-border)] animate-in fade-in slide-in-from-top-2 duration-200">

                        {/* How it works */}
                        <div className="bg-[var(--color-background-secondary)] rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-400" />
                                How it works
                            </h4>
                            <ul className="text-xs text-gray-400 space-y-2">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                                    <span>Uses random device ID to appear as a new user</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                                    <span>Forces 'site' player type to reduce pre-roll ads</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                                    <span>Detects ads via 'stitched' markers and segment analysis</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                                    <span>Tries backup streams: {backupTypesDisplay}</span>
                                </li>
                            </ul>
                        </div>

                        {/* Hide & Mute Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                            <div className="space-y-0.5">
                                <Label className="text-sm">Hide & Mute Ads (Fallback)</Label>
                                <p className="text-xs text-gray-400">
                                    Mute audio and show overlay if ads leak through
                                </p>
                            </div>
                            <Switch
                                checked={adBlockConfig.hideAdsDuringPlayback}
                                onCheckedChange={handleToggleHideAds}
                                className="data-[state=checked]:bg-purple-500 [&_span]:bg-white"
                            />
                        </div>

                        {/* Status Overlay Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                            <div className="space-y-0.5">
                                <Label className="text-sm">Show Status Overlay</Label>
                                <p className="text-xs text-gray-400">
                                    Display blocking status in the top-left corner (e.g., "Blocking midroll ads")
                                </p>
                            </div>
                            <Switch
                                checked={adBlockConfig.showStatusOverlay}
                                onCheckedChange={(show) => updateAdBlockConfig({ showStatusOverlay: show })}
                                className="data-[state=checked]:bg-purple-500 [&_span]:bg-white"
                            />
                        </div>

                        <div className="flex items-start gap-2 text-xs text-gray-400 bg-purple-500/10 border border-purple-500/20 p-3 rounded-md">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                            <p>
                                Based on <strong>TwitchAdSolutions VAFT</strong> - the most effective open-source ad-blocking method for Twitch.
                                All settings are automatically optimized for best results.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
