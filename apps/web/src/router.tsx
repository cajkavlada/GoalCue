import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import {
  createRouter as createTanStackRouter,
  ErrorComponent,
} from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";

import { ConvexProvider, ConvexReactClient } from "@gc/convex";

import { routeTree } from "./routeTree.gen";
import { DialogProvider } from "@gc/ui";

export function createRouter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!;
  if (!CONVEX_URL) {
    console.error("missing envar VITE_CONVEX_URL");
  }
  const convex = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  });
  const convexQueryClient = new ConvexQueryClient(convex);

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: "intent",
      context: { queryClient, convexClient: convex, convexQueryClient },
      Wrap: ({ children }: { children: React.ReactNode }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>
          <DialogProvider>
            {children}
          </DialogProvider>
        </ConvexProvider>
      ),
      scrollRestoration: true,
      defaultErrorComponent: ErrorComponent,
    }),
    queryClient
  );

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
