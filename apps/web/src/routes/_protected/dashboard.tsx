import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";
import { Button, useDialog } from "@gc/ui";

import { TaskForm } from "@/features/tasks/task-form";
import { TaskList } from "@/features/tasks/task-list";

export const Route = createFileRoute("/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { openDialog } = useDialog();
  return (
    <ErrorSuspense>
      <Button onClick={() => openDialog(<TaskForm />)}>Create Task</Button>
      <TaskList />
    </ErrorSuspense>
  );
}
