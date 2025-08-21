import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";

import { getYesterdayTimestamp } from "@/utils/time";
import { TasksSection } from "./task-section";

export function TaskList() {
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
    <div>
      <TasksSection
        tasks={uncompletedTasks}
        emptyMessage={m.tasks_section_uncompleted_empty_message()}
      />
      {recentlyCompletedTasks.length > 0 && (
        <div>{m.tasks_section_completed_title()}</div>
      )}
      <TasksSection
        tasks={recentlyCompletedTasks}
        completedAfter={yesterdayTimestamp}
      />
    </div>
  );
}
