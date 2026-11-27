import { createFileRoute } from "@tanstack/react-router";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@gc/ui";

import { PlanningTimeSettings } from "@/features/tasks/schedule-constraints";

export const Route = createFileRoute(
  "/{-$locale}/_protected/settings/planning-time"
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{m.constraints_planning_time()}</CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorSuspense>
          <PlanningTimeSettings />
        </ErrorSuspense>
      </CardContent>
    </Card>
  );
}
