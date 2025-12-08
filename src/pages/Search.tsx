import { Button } from '@/components/ui/button';

export function SearchPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">🔍 Search</h1>
      
      <div className="max-w-2xl">
        <input
          type="text"
          placeholder="Search channels, streams, or categories..."
          className="w-full h-12 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-tertiary)] text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-storm-primary)]"
        />
        
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" size="sm">All</Button>
          <Button variant="ghost" size="sm">Channels</Button>
          <Button variant="ghost" size="sm">Streams</Button>
          <Button variant="ghost" size="sm">Categories</Button>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-[var(--color-foreground-secondary)]">
          Start typing to search across Twitch and Kick
        </p>
      </div>
    </div>
  );
}
