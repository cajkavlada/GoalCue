import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { WorkCalendars } from "@/features/work-calendars";

export const Route = createFileRoute(
  "/{-$locale}/_protected/settings/work-calendars"
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <WorkCalendars />
    </ErrorSuspense>
  );
}
