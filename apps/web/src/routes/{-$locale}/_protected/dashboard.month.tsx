import { createFileRoute } from "@tanstack/react-router";

import { PlanView } from "@/features/tasks/plan-view";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard/month")({
  component: () => <PlanView view="month" />,
});
