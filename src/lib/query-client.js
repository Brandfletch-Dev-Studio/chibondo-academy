import { QueryClient, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // Do NOT refetch when window regains focus — prevents jarring auth re-checks
      // on tab switch which can momentarily show the user as logged out.
      refetchOnWindowFocus: false,

      // Retry failed requests up to 3 times with exponential back-off before
      // giving up. This means a single network blip won't cause an auth.me()
      // failure that drops the user to guest state.
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),

      // Keep successful data fresh for 15 minutes. Re-fetches happen in the
      // background and only replace stale data when the new request succeeds —
      // so a background refetch failure does NOT wipe out the cached user.
      staleTime: 15 * 60_000,

      // Keep unused (unmounted) query data in cache for 1 hour.
      // This means navigating away and back won't trigger a new auth.me() call
      // before the staleTime window has elapsed.
      gcTime: 60 * 60_000,
    },
    mutations: {
      // Retry mutations once on network failure — not on 4xx errors.
      retry: (failureCount, error) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 1;
      },
    },
  },
  mutationCache: new MutationCache({
    // Global fallback — only shows a toast if the mutation itself
    // doesn't have its own onError handler.
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return; // mutation handles its own errors
      const msg = error?.message || 'Something went wrong. Please try again.';
      toast.error(msg);
    },
  }),
});
