import { Link } from "@tanstack/react-router";

import { FeaturedStream } from "@/components/stream/featured-stream";
import { Button } from "@/components/ui/button";
import { useTopStreams } from "@/hooks/queries/useStreams";

import { LiveNowSection } from "./components/live-now-section";

export function HomePage() {
  const { data: streams, isLoading, error } = useTopStreams(undefined, 25);

  const featuredStream = streams && streams.length > 0 ? streams[0] : undefined;
  const otherStreams = streams && streams.length > 1 ? streams.slice(1) : [];

  if (error) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 text-center">
        <div className="text-red-500 text-xl font-bold">Failed to load streams</div>
        <p className="text-[var(--color-foreground-secondary)]">{error.message}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-[1800px] mx-auto">
      {/* Featured Stream Section */}
      <section>
        <FeaturedStream stream={featuredStream} isLoading={isLoading} />
      </section>

      {/* Live Channels Section */}
      <LiveNowSection streams={otherStreams} isLoading={isLoading} />

      {/* Browse Categories Link */}
      <div className="flex justify-center pt-8">
        <Link to="/categories">
          <Button variant="outline" size="lg" className="rounded-full px-8">
            Browse All Categories
          </Button>
        </Link>
      </div>
    </div>
  );
}
