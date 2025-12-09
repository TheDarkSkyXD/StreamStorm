import { RouterProvider } from '@tanstack/react-router';

import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { router } from '@/routes/router';
import { TooltipProvider } from '@/components/ui/tooltip';

function App() {
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
