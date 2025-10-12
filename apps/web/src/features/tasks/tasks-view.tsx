import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";
import { SelectableList } from "@gc/react-kit";

import { getYesterdayTimestamp } from "@/utils/time";
import { TaskList } from "./task-list";

export function TasksView() {
  const { data: uncompletedTasks } = useSuspenseQuery(
    convexQuery(api.tasks.getUncompletedExtendedForUserId, {})
  );

  const yesterdayTimestamp = getYesterdayTimestamp();

  const { data: recentlyCompletedTasks } = useSuspenseQuery(
    convexQuery(api.tasks.getRecentlyCompletedExtendedForUserId, {
      completedAfter: yesterdayTimestamp,
    })
  );

  return (
    <>
      <SelectableList items={uncompletedTasks}>
        <TaskList
          tasks={uncompletedTasks}
          emptyMessage={m.tasks_section_uncompleted_empty_message()}
        />
      </SelectableList>
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
