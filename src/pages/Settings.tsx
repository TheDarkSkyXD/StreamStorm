import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/app-store';
import { useAppVersion } from '@/hooks';

export function SettingsPage() {
  const { theme, setTheme } = useAppStore();
  const appVersion = useAppVersion();

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">⚙️ Settings</h1>

      <div className="space-y-6">
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
                  variant={theme === 'light' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setTheme('light')}
                >
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setTheme('system')}
                >
                  System
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="badge-twitch">Twitch</span>
                <span className="text-[var(--color-foreground-secondary)]">Not connected</span>
              </div>
              <Button variant="twitch" size="sm">Connect</Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="badge-kick">Kick</span>
                <span className="text-[var(--color-foreground-secondary)]">Not connected</span>
              </div>
              <Button variant="kick" size="sm">Connect</Button>
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
              <select className="h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)]">
                <option>Auto</option>
                <option>1080p</option>
                <option>720p</option>
                <option>480p</option>
              </select>
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
