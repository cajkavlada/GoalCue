import { createFileRoute } from "@tanstack/react-router";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@gc/ui";

import { PriorityClassCard } from "@/features/priority-classes/priority-class-card";
import { TagCard } from "@/features/tags/tag-card";
import { TaskTypeCard } from "@/features/task-types/task-type-card";
import { PlanningTimeSettings } from "@/features/tasks/schedule-constraints";
import { UnitCard } from "@/features/units/unit-card";
import { WorkCalendars } from "@/features/work-calendars";

export const Route = createFileRoute("/{-$locale}/_protected/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <Card className="mx-auto w-full max-w-xl shrink-0">
        <CardHeader>
          <CardTitle>{m.constraints_planning_time()}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorSuspense>
            <PlanningTimeSettings />
          </ErrorSuspense>
        </CardContent>
      </Card>
      <ErrorSuspense>
        <WorkCalendars />
      </ErrorSuspense>
      <div className="flex min-h-96 shrink-0 flex-wrap justify-center gap-4">
        <TaskTypeCard />
        <UnitCard />
        <PriorityClassCard />
        <TagCard />
      </div>
    </div>
  );
}
