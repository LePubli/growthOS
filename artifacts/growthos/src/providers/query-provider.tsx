import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { useState } from 'react';
import { onQueryError, onMutationError } from '@/lib/query-errors';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => onQueryError(error),
    }),
    mutationCache: new MutationCache({
      onError: (error) => onMutationError(error),
    }),
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
