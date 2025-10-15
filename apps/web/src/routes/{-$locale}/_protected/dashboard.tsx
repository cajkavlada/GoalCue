import { createFileRoute } from "@tanstack/react-router";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { DrawerButton } from "@gc/ui";

import { TaskCreateDrawer } from "@/features/tasks/task-create-drawer";
import { TasksView } from "@/features/tasks/tasks-view";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-full flex-col">
      <div>
        <DrawerButton drawerContent={<TaskCreateDrawer />}>
          {m.tasks_create_button_label()}
        </DrawerButton>
      </div>
      <ErrorSuspense>
        <TasksView />
      </ErrorSuspense>
    </div>
  );
}
