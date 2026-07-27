"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ClinicProvider, type ClinicSettings } from "@/components/providers/clinic-provider";

interface ProvidersProps {
  children: React.ReactNode;
  /** Server-fetched clinic settings passed from the root layout Server Component.
   *  Eliminates flash of default branding on first render. */
  initialClinicSettings?: ClinicSettings;
}

export function Providers({ children, initialClinicSettings }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <QueryClientProvider client={queryClient}>
        <ClinicProvider initialSettings={initialClinicSettings}>
          {children}
          <Toaster />
        </ClinicProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}