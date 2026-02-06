import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/router';
import { useAppPreferences } from '../shared/store/useAppPreferences';
import { useResolvedTheme } from '../shared/hooks/useResolvedTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false
    }
  }
});

export function App() {
  const theme = useAppPreferences((s) => s.theme);
  const resolvedTheme = useResolvedTheme(theme);

  return (
    <div data-theme={resolvedTheme} className="app-shell">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </div>
  );
}
