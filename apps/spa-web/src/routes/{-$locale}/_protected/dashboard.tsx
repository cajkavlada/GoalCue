import { createFileRoute } from "@tanstack/react-router";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { DialogButton } from "@gc/ui";

import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import { TaskList } from "@/features/tasks/task-list";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <DialogButton dialogContent={<TaskFormDialog />}>
        {m.tasks_create_button_label()}
      </DialogButton>
      <ErrorSuspense>
        <TaskList />
      </ErrorSuspense>
    </>
  );
}
