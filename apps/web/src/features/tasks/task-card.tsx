import { Plus } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense, SelectableList } from "@gc/react-kit";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  DrawerButton,
  Separator,
} from "@gc/ui";

import { getYesterdayTimestamp } from "@/utils/time";
import { TaskCreateDrawer } from "./task-create-drawer";
import { TaskList } from "./task-list";
import { taskApi } from "./task.api";

export function TaskCard() {
  return (
    <Card className="min-w-sm flex h-full max-w-md flex-col p-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{m.tasks_heading()}</CardTitle>
        <CardAction>
          <DrawerButton
            drawerContent={<TaskCreateDrawer />}
            size="icon"
            tooltip={m.tasks_create_button_label()}
          >
            <Plus />
          </DrawerButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden">
        <ErrorSuspense>
          <TaskCardLists />
        </ErrorSuspense>
      </CardContent>
    </Card>
  );
}

function TaskCardLists() {
  const yesterdayTimestamp = getYesterdayTimestamp();

  const { data: uncompletedTasks } = taskApi.useUncompletedExtendedList();
  const { data: recentlyCompletedTasks } =
    taskApi.useRecentlyCompletedExtendedList({
      completedAfter: yesterdayTimestamp,
    });

  return (
    <>
      <SelectableList items={uncompletedTasks}>
        <TaskList
          className="flex-2"
          tasks={uncompletedTasks}
          emptyMessage={m.tasks_section_uncompleted_empty_message()}
        />
      </SelectableList>
      <Separator className="my-4" />
      {recentlyCompletedTasks.length > 0 && (
        <div>{m.tasks_section_completed_title()}</div>
      )}
      <SelectableList items={recentlyCompletedTasks}>
        <TaskList
          tasks={recentlyCompletedTasks}
          completedAfter={yesterdayTimestamp}
        />
      </SelectableList>
    </>
  );
}
