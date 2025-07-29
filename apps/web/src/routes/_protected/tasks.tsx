import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { TaskForm } from "@/features/tasks/task-form";

export const Route = createFileRoute("/_protected/tasks")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <TaskForm />
    </ErrorSuspense>
  );
}
