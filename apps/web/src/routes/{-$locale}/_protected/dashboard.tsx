import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { DayView } from "@/features/tasks/day-view";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <DayView />
    </ErrorSuspense>
  );
}
