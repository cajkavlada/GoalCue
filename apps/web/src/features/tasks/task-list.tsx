import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";

export function TaskList() {
  const { data: tasks } = useSuspenseQuery(
    convexQuery(api.tasks.getAllExtendedForUserId, {})
  );

  // const { mutate: addTaskAction } = useMutation({
  //   mutationFn: useConvexMutation(api.taskActions.add),
  // });

  // function handleAddTaskAction(
  //   task: Doc<"tasks"> & { taskType: Doc<"taskTypes"> }
  // ) {
  //   addTaskAction({
  //     taskId: task._id,
  //     booleanValue: undefined,
  //     numValue: undefined,
  //     enumOptionId: task.taskType.completedEnumOptionId,
  //   });
  // }

  return (
    <div>
      {tasks.map((task) => (
        <div
          key={task._id}
          className="flex items-center gap-2"
        >
          {task.title}
          {task.completed ? "  Done" : "  Not done"}
          {/* <Button onClick={() => handleAddTaskAction(task)}>
            Add task action
          </Button> */}
        </div>
      ))}
    </div>
  );
}
