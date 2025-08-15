import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";

export function TaskList() {
  const { data: tasks } = useSuspenseQuery(
    convexQuery(api.tasks.getAllExtendedForUserId, {})
  );

  return (
    <div>
      {tasks.map((task) => (
        <div key={task._id}>{task.title}</div>
      ))}
    </div>
  );
}
