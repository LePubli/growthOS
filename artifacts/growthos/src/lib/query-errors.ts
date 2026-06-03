import { toast } from 'sonner';

/** Extract a human-readable message from any API error shape. */
function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const body = JSON.parse(error.message);
      return body?.message ?? body?.error ?? error.message;
    } catch {
      return error.message;
    }
  }
  if (typeof error === 'string') return error;
  return 'Une erreur inattendue est survenue.';
}

/**
 * Global TanStack Query error handler.
 * Wire into QueryClient defaultOptions → queries.meta OR via the
 * queryCache / mutationCache onError callbacks.
 */
export function onQueryError(error: unknown, label?: string) {
  const msg = extractMessage(error);
  const prefix = label ? `${label} : ` : '';
  toast.error(`${prefix}${msg}`, { duration: 5000 });
  console.error('[QueryError]', error);
}

export function onMutationError(error: unknown, label?: string) {
  const msg = extractMessage(error);
  const prefix = label ? `${label} : ` : '';
  toast.error(`${prefix}${msg}`, { duration: 5000 });
  console.error('[MutationError]', error);
}
