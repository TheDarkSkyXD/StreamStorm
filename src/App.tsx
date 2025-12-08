import { RouterProvider } from '@tanstack/react-router';
import { QueryProvider } from '@/providers/query-provider';
import { router } from '@/routes/router';

function App() {
  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}

export default App;
