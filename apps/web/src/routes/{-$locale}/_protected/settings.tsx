import { createFileRoute } from "@tanstack/react-router";

import { TaskTypeCard } from "@/features/task-types/task-type-card";
import { UnitCard } from "@/features/units/unit-card";

export const Route = createFileRoute("/{-$locale}/_protected/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-full justify-center gap-4 p-4">
      <TaskTypeCard />
      <UnitCard />
    </div>
  );
}
