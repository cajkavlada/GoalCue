import { createFileRoute } from "@tanstack/react-router";

import { PriorityClassCard } from "@/features/priority-classes/priority-class-card";
import { TagCard } from "@/features/tags/tag-card";
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
      <PriorityClassCard />
      <TagCard />
    </div>
  );
}
