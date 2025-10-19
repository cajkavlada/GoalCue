import { createFileRoute } from "@tanstack/react-router";

import { TaskTypeCard } from "@/features/task-types/task-type-card";

export const Route = createFileRoute("/{-$locale}/_protected/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-full justify-center p-4">
      <TaskTypeCard />
    </div>
  );
}
