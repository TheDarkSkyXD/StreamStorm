export function StreamPage() {
  return (
    <div className="h-full flex">
      {/* Video Player Area */}
      <div className="flex-1 flex flex-col">
        <div className="aspect-video bg-black flex items-center justify-center">
          <span className="text-white/50">Video Player</span>
        </div>
        <div className="p-4">
          <h1 className="text-xl font-bold">Stream Title</h1>
          <p className="text-[var(--color-foreground-secondary)]">Streamer Name • Category</p>
        </div>
      </div>
      
      {/* Chat Panel */}
      <div className="w-80 border-l border-[var(--color-border)] bg-[var(--color-background-secondary)] flex flex-col">
        <div className="p-3 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Chat</h2>
        </div>
        <div className="flex-1 p-3">
          <p className="text-[var(--color-foreground-muted)] text-sm">Chat messages will appear here</p>
        </div>
        <div className="p-3 border-t border-[var(--color-border)]">
          <input
            type="text"
            placeholder="Send a message..."
            className="w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)] text-sm"
          />
        </div>
      </div>
    </div>
  );
}
