import { m } from "@gc/i18n/messages";
import { ErrorSuspense, SelectableList } from "@gc/react-kit";
import { Separator } from "@gc/ui";

import { getYesterdayTimestamp } from "@/utils/time";
import { TaskList } from "./task-list";
import { taskApi } from "./task.api";

export function TaskCard() {
  return (
    <div className="w-full min-w-0">
      <ErrorSuspense>
        <TaskCardLists />
      </ErrorSuspense>
    </div>
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
          tasks={uncompletedTasks}
          emptyMessage={m.tasks_section_uncompleted_empty_message()}
        />
      </SelectableList>
      {recentlyCompletedTasks.length > 0 && (
        <>
          <Separator className="my-4" />
          <div>{m.tasks_section_completed_title()}</div>
          <SelectableList items={recentlyCompletedTasks}>
            <TaskList
              tasks={recentlyCompletedTasks}
              completedAfter={yesterdayTimestamp}
            />
          </SelectableList>
        </>
      )}
    </>
  );
}
