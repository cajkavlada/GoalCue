import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { TaskTypeCard } from "@/features/task-types/task-type-card";

export const Route = createFileRoute(
  "/{-$locale}/_protected/settings/task-types"
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <TaskTypeCard />
    </ErrorSuspense>
  );
}
