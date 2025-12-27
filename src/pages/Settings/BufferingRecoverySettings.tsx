import { Activity, Gauge, Info, RefreshCcw, Bell, BellOff } from 'lucide-react';
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
    BufferingRecoveryPreferences,
    DEFAULT_BUFFERING_RECOVERY_PREFERENCES,
    BUFFERING_RECOVERY_PRESETS
} from '@/shared/auth-types';

export function BufferingRecoverySettings() {
    const preferences = useAuthStore(state => state.preferences);
    const updatePreferences = useAuthStore(state => state.updatePreferences);

    // Get current config with fallbacks
    const recoveryConfig = preferences?.advanced?.bufferingRecovery ?? DEFAULT_BUFFERING_RECOVERY_PREFERENCES;

    const updateRecoveryConfig = async (updates: Partial<BufferingRecoveryPreferences>) => {
        const currentAdvanced = preferences?.advanced || {
            enableImageProxy: true,
            streamProxy: { selectedProxy: 'none', fallbackToDirect: true } as const,
            adBlock: { enabled: false, hideAdsDuringPlayback: true, showStatusOverlay: true },
            bufferingRecovery: DEFAULT_BUFFERING_RECOVERY_PREFERENCES,
            enhancedFeatures: { visibilitySpoofing: false, forceAvcCodec: false, adSegmentStripping: false, adStrippingMode: 'placeholder' as const }
        };

        await updatePreferences({
            advanced: {
                ...currentAdvanced,
                bufferingRecovery: {
                    ...recoveryConfig,
                    ...updates
                }
            }
        });
    };

    const handleToggleEnabled = async (enabled: boolean) => {
        await updateRecoveryConfig({ enabled });
    };

    const handleSensitivityChange = async (sensitivity: 'low' | 'medium' | 'high') => {
        await updateRecoveryConfig({ sensitivity });
    };

    const handleToggleNotification = async (showNotification: boolean) => {
        await updateRecoveryConfig({ showNotification });
    };

    // Get current sensitivity preset details
    const currentPreset = BUFFERING_RECOVERY_PRESETS[recoveryConfig.sensitivity];

    return (
        <Card className="border-[var(--color-border)]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Stream Recovery
                </CardTitle>
                <CardDescription>
                    Automatically detect and refresh stuck or buffering streams.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Master Switch */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-base">Enable Auto-Recovery</Label>
                        <p className="text-sm text-[var(--color-foreground-secondary)]">
                            Automatically refresh the stream when playback gets stuck
                        </p>
                    </div>
                    <Switch
                        checked={recoveryConfig.enabled}
                        onCheckedChange={handleToggleEnabled}
                        className="data-[state=checked]:bg-blue-500 [&_span]:bg-white"
                    />
                </div>

                {recoveryConfig.enabled && (
                    <div className="space-y-4 pt-4 border-t border-[var(--color-border)] animate-in fade-in slide-in-from-top-2 duration-200">

                        {/* Recovery Action Info */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                            <div className="space-y-0.5">
                                <Label className="text-sm flex items-center gap-2">
                                    <RefreshCcw className="w-4 h-4 text-blue-400" />
                                    Recovery Action
                                </Label>
                                <p className="text-xs text-gray-400">
                                    Refreshes the stream to restore playback
                                </p>
                            </div>
                            <span className="text-sm text-gray-300 font-medium">
                                Stream Refresh
                            </span>
                        </div>

                        {/* Detection Sensitivity */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm flex items-center gap-2">
                                        <Gauge className="w-4 h-4 text-gray-400" />
                                        Detection Sensitivity
                                    </Label>
                                    <p className="text-xs text-gray-400">
                                        How quickly to detect stuck streams
                                    </p>
                                </div>
                                <Select
                                    value={recoveryConfig.sensitivity}
                                    onValueChange={(v) => handleSensitivityChange(v as 'low' | 'medium' | 'high')}
                                >
                                    <SelectTrigger className="w-32 h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Sensitivity Details */}
                            <div className="bg-[var(--color-background-secondary)] rounded-lg p-3 text-xs text-gray-400">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>Stuck checks: <span className="text-gray-300">{currentPreset.sameStateThreshold}</span></div>
                                    <div>Danger zone: <span className="text-gray-300">&lt;{currentPreset.dangerZoneSeconds}s buffer</span></div>
                                    <div>Cooldown: <span className="text-gray-300">{currentPreset.minRepeatDelayMs / 1000}s</span></div>
                                    <div>Check interval: <span className="text-gray-300">{currentPreset.checkIntervalMs}ms</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Show Notification Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                            <div className="space-y-0.5">
                                <Label className="text-sm flex items-center gap-2">
                                    {recoveryConfig.showNotification ? (
                                        <Bell className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <BellOff className="w-4 h-4 text-gray-400" />
                                    )}
                                    Recovery Notifications
                                </Label>
                                <p className="text-xs text-gray-400">
                                    Show a brief notification when stream is refreshed
                                </p>
                            </div>
                            <Switch
                                checked={recoveryConfig.showNotification}
                                onCheckedChange={handleToggleNotification}
                                className="data-[state=checked]:bg-blue-500 [&_span]:bg-white"
                            />
                        </div>

                        {/* Info box */}
                        <div className="flex items-start gap-2 text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 p-3 rounded-md">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                            <p>
                                Stream recovery monitors playback position and buffer levels to detect when
                                the stream is stuck. When detected, it automatically refreshes the stream
                                to restore playback without requiring manual intervention.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
