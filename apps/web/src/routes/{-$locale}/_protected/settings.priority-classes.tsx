import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { PriorityClassCard } from "@/features/priority-classes/priority-class-card";

export const Route = createFileRoute(
  "/{-$locale}/_protected/settings/priority-classes"
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <PriorityClassCard />
    </ErrorSuspense>
  );
}
