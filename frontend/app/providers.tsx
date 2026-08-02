"use client";

import { useEffect, useState } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster, toast } from "sonner";
import { AuthProvider } from "../contexts/AuthContext";
import { PawTrail } from "../components/motion/PawTrail";
import { ApiError } from "../lib/api";

/** Human message for a failed request, without leaking internals. */
function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) return "Something went wrong on our side — we're on it. Try again shortly.";
    return error.message;
  }
  return "Couldn't reach Sidelick — check your connection and try again.";
}

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per app instance.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            // Retry once on server/network errors; 4xx won't heal by retrying.
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.statusCode < 500) return false;
              return failureCount < 1;
            },
          },
        },
        // Global error surfacing: failed READS toast exactly once (per query),
        // so a broken screen is never silent. Skipped when:
        //  - cached data is still on screen (background refetch hiccup), or
        //  - it's a 401 (the auth flow redirects; toasting would be noise).
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.state.data !== undefined) return;
            if (error instanceof ApiError && error.statusCode === 401) return;
            toast.error(loadErrorMessage(error), { id: `q-${query.queryHash}` });
          },
        }),
      })
  );

  // Register the PWA service worker (push + installable shell).
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non-fatal */
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthProvider>
          {children}
          <PawTrail />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
