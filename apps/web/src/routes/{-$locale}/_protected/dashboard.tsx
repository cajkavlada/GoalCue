import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";
import { Button, useDialog } from "@gc/ui";

import { TaskForm } from "@/features/tasks/task-form";
import { TaskList } from "@/features/tasks/task-list";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { openDialog } = useDialog();
  return (
    <>
      <Button onClick={() => openDialog(<TaskForm />)}>
        {m.tasks_create_button_label()}
      </Button>
      <ErrorSuspense>
        <TaskList />
      </ErrorSuspense>
    </>
  );
}
