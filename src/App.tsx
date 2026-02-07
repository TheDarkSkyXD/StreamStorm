import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/providers/query-provider';
import { router } from '@/routes/router';
import { initializeEmoteProviders } from '@/backend/services/emotes';

function App() {
  useEffect(() => {
    // Initialize emote providers (register them with manager)
    initializeEmoteProviders();
  }, []);

  return (
    <QueryProvider>
      <TooltipProvider>
        <AuthProvider fallback={<div className="flex h-screen w-full items-center justify-center bg-background text-foreground">Loading StreamStorm...</div>}>
          <RouterProvider router={router} />
        </AuthProvider>
      </TooltipProvider>
    </QueryProvider>
  );
}

export default App;
