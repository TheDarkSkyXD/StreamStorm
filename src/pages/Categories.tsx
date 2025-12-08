import { Card, CardContent } from '@/components/ui/card';

export function CategoriesPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">📂 Categories</h1>
      <p className="text-[var(--color-foreground-secondary)] mb-8">
        Browse streams by game or category
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {['Just Chatting', 'Fortnite', 'Valorant', 'League of Legends', 'Minecraft', 'GTA V', 'Counter-Strike', 'Apex Legends'].map((category) => (
          <Card key={category} className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-[var(--color-storm-primary)] transition-all">
            <div className="aspect-[3/4] bg-gradient-to-br from-[var(--color-storm-primary)] to-[var(--color-storm-secondary)] flex items-center justify-center">
              <span className="text-2xl">🎮</span>
            </div>
            <CardContent className="p-3">
              <h3 className="font-semibold text-sm line-clamp-1">{category}</h3>
              <p className="text-xs text-[var(--color-foreground-muted)]">12.5K viewers</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
