import { AlertCircle } from 'lucide-react';

import { AccountConnect } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppVersion } from '@/hooks';
import { useAuthError } from '@/hooks/useAuth';
import { useAppStore } from '@/store/app-store';

export function SettingsPage() {
  const { theme, setTheme } = useAppStore();
  const appVersion = useAppVersion();

  // Get auth state
  const { error, clearError } = useAuthError();

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

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-[var(--color-foreground-secondary)]">
                  Choose your preferred color scheme
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className={theme === 'light' ? 'bg-white text-black hover:bg-gray-100' : ''}
                  size="sm"
                  onClick={() => setTheme('light')}
                >
                  Light
                </Button>
                <Button
                  variant="secondary"
                  className={theme === 'dark' ? 'bg-white text-black hover:bg-gray-100' : ''}
                  size="sm"
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <Select defaultValue="auto">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
