import { UseAuthReturn } from "@clerk/types";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ConvexReactClient } from "@gc/convex";
import { DialogProvider, Toaster } from "@gc/ui";

export const Route = createRootRouteWithContext<{
  auth: UseAuthReturn;
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
}>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <DialogProvider>
        <Outlet />
      </DialogProvider>
      <Toaster />
      <TanStackRouterDevtools />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
