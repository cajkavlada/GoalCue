import { createFileRoute } from "@tanstack/react-router";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { DialogButton } from "@gc/ui";

import { TaskCreateDialog } from "@/features/tasks/task-create-dialog";
import { TaskList } from "@/features/tasks/task-list";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-full flex-col">
      <div>
        <DialogButton dialogContent={<TaskCreateDialog />}>
          {m.tasks_create_button_label()}
        </DialogButton>
      </div>
      <ErrorSuspense>
        <TaskList />
      </ErrorSuspense>
    </div>
  );
}
