import { createFileRoute, Outlet } from "@tanstack/react-router";
import z from "zod";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";

import { PlanningChat } from "@/features/planning-chat";

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
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </div>
        <details className="shrink-0 border-t">
          <summary className="cursor-pointer px-4 py-2">
            {m.chat_title()}
          </summary>
          <ErrorSuspense>
            <PlanningChat />
          </ErrorSuspense>
        </details>
      </div>
    </ErrorSuspense>
  );
}
