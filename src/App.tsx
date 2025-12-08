import { RouterProvider } from '@tanstack/react-router';

import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { router } from '@/routes/router';

function App() {
  return (
    <QueryProvider>
      <AuthProvider fallback={<div className="flex h-screen w-full items-center justify-center bg-background text-foreground">Loading StreamStorm...</div>}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryProvider>
  );
}

export default App;
