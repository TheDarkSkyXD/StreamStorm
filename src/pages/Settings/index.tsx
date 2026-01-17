import { AlertCircle, AlertTriangle, Download, RefreshCw, Rocket, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { AccountConnect } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAppVersion, useUpdater } from '@/hooks';
import { useAuthError } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth-store';
import { useAdBlockStore } from '@/store/adblock-store';
import { VideoQuality } from '@/shared/auth-types';

export function SettingsPage() {

  const appVersion = useAppVersion();

  // Get auth state
  const { error, clearError } = useAuthError();
  const preferences = useAuthStore(state => state.preferences);
  const updatePreferences = useAuthStore(state => state.updatePreferences);

  // Ad-block state
  const enableAdBlock = useAdBlockStore(state => state.enableAdBlock);
  const setEnableAdBlock = useAdBlockStore(state => state.setEnableAdBlock);

  // Updater state
  const {
    status,
    updateInfo,
    progress,
    error: updateError,
    allowPrerelease,
    isChecking,
    isDownloading,
    isUpdateAvailable,
    isUpdateDownloaded,
    hasError,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    setAllowPrerelease,
  } = useUpdater();

  const [saved, setSaved] = useState(false);

  const handleQualityChange = async (value: string) => {
    // Cast string to VideoQuality since we know the values are valid
    const quality = value as VideoQuality;

    // Update store
    await updatePreferences({
      playback: {
        ...preferences?.playback!,
        defaultQuality: quality
      }
    });

    // Show saved indicator
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Auth Error Alert */}
        {error && (
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${error.platform === 'twitch'
            ? 'bg-[#9146FF]/10 border-[#9146FF]/30 text-[#9146FF]'
            : error.platform === 'kick'
              ? 'bg-[#53FC18]/10 border-[#53FC18]/30 text-[#53FC18]'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">
                {error.platform === 'twitch' ? 'Twitch Connection Error' :
                  error.platform === 'kick' ? 'Kick Connection Error' :
                    'Authentication Error'}
              </p>
              <p className="text-sm mt-1 opacity-90">{error.message}</p>
            </div>
            <button
              onClick={clearError}
              className={`hover:opacity-70 text-sm ${error.platform === 'twitch'
                ? 'text-[#9146FF]'
                : error.platform === 'kick'
                  ? 'text-[#53FC18]'
                  : 'text-red-400'
                }`}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Accounts Section */}
        <div>
          <h2 className="text-lg font-semibold mb-3 ml-1">Connected Accounts</h2>
          <AccountConnect />
        </div>



        {/* Playback */}
        <Card>
          <CardHeader>
            <CardTitle>Playback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Default Quality</p>
                <p className="text-sm text-[var(--color-foreground-secondary)]">
                  Preferred stream quality when available
                </p>
              </div>
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="text-sm text-green-500 font-medium animate-in fade-in slide-in-from-right-2 duration-300">
                    Saved
                  </span>
                )}
                <Select
                  value={preferences?.playback?.defaultQuality || 'auto'}
                  onValueChange={handleQualityChange}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="1080p">1080p60</SelectItem>
                    <SelectItem value="720p">720p60</SelectItem>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="360p">360p</SelectItem>
                    <SelectItem value="160p">160p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client-Side Ad-Blocking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              Ad-Block (Twitch)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Ad-Blocking</p>
                <p className="text-sm text-[var(--color-foreground-secondary)]">
                  Block Twitch ads using alternative player tokens
                </p>
              </div>
              <Switch
                checked={enableAdBlock}
                onCheckedChange={setEnableAdBlock}
                className="data-[state=checked]:!bg-green-500 data-[state=checked]:!border-green-500"
              />
            </div>
            <p className="text-xs text-[var(--color-foreground-muted)] pt-2 border-t border-[var(--color-border)]">
              Uses VAFT technique to request ad-free streams via backup player types.
              Works without external proxies. A shield icon appears in the player when active.
            </p>
          </CardContent>
        </Card>

        {/* Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pre-release Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Allow Pre-release Updates</p>
                <p className="text-sm text-[var(--color-foreground-secondary)]">
                  Receive beta and preview versions before stable release
                </p>
              </div>
              <Switch
                checked={allowPrerelease}
                onCheckedChange={setAllowPrerelease}
                className="data-[state=checked]:!bg-blue-500 data-[state=checked]:!border-blue-500"
              />
            </div>

            {/* Check for Updates Button */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
              <div>
                <p className="font-medium">Check for Updates</p>
                <p className="text-sm text-[var(--color-foreground-secondary)]">
                  {status === 'idle' && 'Click to check for available updates'}
                  {status === 'checking' && 'Checking for updates...'}
                  {status === 'not-available' && 'You are on the latest version'}
                  {status === 'available' && `Version ${updateInfo?.version} is available`}
                  {status === 'downloading' && 'Downloading update...'}
                  {status === 'downloaded' && 'Update ready to install'}
                  {status === 'error' && 'Failed to check for updates'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={checkForUpdates}
                disabled={isChecking || isDownloading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                Check Now
              </Button>
            </div>

            {/* Error State */}
            {hasError && updateError && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm">{updateError}</p>
                </div>
              </div>
            )}

            {/* Update Available Info */}
            {isUpdateAvailable && updateInfo && (
              <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {updateInfo.releaseName || `Version ${updateInfo.version}`}
                    </p>
                    {updateInfo.releaseDate && (
                      <p className="text-sm text-[var(--color-foreground-secondary)]">
                        Released {new Date(updateInfo.releaseDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={downloadUpdate}
                    disabled={isDownloading}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>

                {/* Release Notes */}
                {updateInfo.releaseNotes && (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                    <div className="px-3 py-2 border-b border-[var(--color-border)]">
                      <p className="text-sm font-medium text-[var(--color-foreground-secondary)]">
                        Release Notes
                      </p>
                    </div>
                    <div className="px-3 py-2 max-h-40 overflow-y-auto">
                      <pre className="text-sm text-[var(--color-foreground-secondary)] whitespace-pre-wrap font-sans">
                        {updateInfo.releaseNotes}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Download Progress */}
            {isDownloading && progress && (
              <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Downloading update...</p>
                  <p className="text-sm text-[var(--color-foreground-secondary)]">
                    {Math.round(progress.percent)}%
                  </p>
                </div>
                <Progress value={progress.percent} className="h-2" />
                <p className="text-xs text-[var(--color-foreground-muted)]">
                  {(progress.transferred / 1024 / 1024).toFixed(1)} MB / {(progress.total / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            )}

            {/* Update Downloaded - Install Button */}
            {isUpdateDownloaded && (
              <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                <div>
                  <p className="font-medium text-green-400">Update Ready</p>
                  <p className="text-sm text-[var(--color-foreground-secondary)]">
                    Restart the app to apply the update
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={installUpdate}
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  Install & Restart
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[var(--color-foreground-secondary)]">
              StreamStorm v{appVersion ?? '0.1.0'}
            </p>
            <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
              Built with Electron + React + TailwindCSS
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
