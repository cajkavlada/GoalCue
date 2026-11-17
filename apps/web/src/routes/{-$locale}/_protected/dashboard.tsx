import { createFileRoute, Outlet } from "@tanstack/react-router";
import z from "zod";

import { ErrorSuspense } from "@gc/react-kit";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard")({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: z.iso.date().optional().catch(undefined).parse(search.date),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <div className="flex h-full min-h-0 flex-col">
        <Outlet />
      </div>
    </ErrorSuspense>
  );
}
