import { createFileRoute } from "@tanstack/react-router";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { DrawerButton } from "@gc/ui";

import { TaskTypeCreateDrawer } from "@/features/task-types/task-type-create-drawer";
import { TaskTypesView } from "@/features/task-types/task-types-view";

export const Route = createFileRoute("/{-$locale}/_protected/task-types")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-full flex-col">
      <div>
        <DrawerButton drawerContent={<TaskTypeCreateDrawer />}>
          {m.taskTypes_create_button_label()}
        </DrawerButton>
      </div>
      <ErrorSuspense>
        <TaskTypesView />
      </ErrorSuspense>
    </div>
  );
}
