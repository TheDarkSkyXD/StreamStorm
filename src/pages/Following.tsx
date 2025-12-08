import { Card, CardContent } from '@/components/ui/card';

export function FollowingPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">❤️ Following</h1>
      <p className="text-[var(--color-foreground-secondary)] mb-8">
        Channels you follow across Twitch and Kick
      </p>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Live Now</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-video bg-[var(--color-background-tertiary)] relative">
                <span className="absolute top-2 left-2 badge-live">LIVE</span>
              </div>
              <CardContent className="pt-4">
                <h3 className="font-semibold">Followed Streamer {i}</h3>
                <p className="text-sm text-[var(--color-foreground-muted)]">Playing Something</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-xl font-semibold mt-8">Offline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-background-tertiary)] mb-2" />
              <p className="text-sm font-medium">Streamer {i}</p>
              <p className="text-xs text-[var(--color-foreground-muted)]">Offline</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
