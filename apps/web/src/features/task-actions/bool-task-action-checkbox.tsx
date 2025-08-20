import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { Checkbox, CheckedState } from "@gc/ui";

export function BoolTaskActionCheckbox({ task }: { task: Doc<"tasks"> }) {
  const { mutate: addTaskAction } = useMutation({
    mutationFn: useConvexMutation(api.taskActions.add).withOptimisticUpdate(
      (localStore, args) => {
        const tasks = localStore.getQuery(api.tasks.getAllExtendedForUserId);
        if (!tasks) return;

        const updatedTasks = tasks.map((task) => {
          if (task._id === args.taskId) {
            return {
              ...task,
              completed: args.booleanValue ?? false,
            };
          }
          return task;
        });
        localStore.setQuery(
          api.tasks.getAllExtendedForUserId,
          {},
          updatedTasks
        );
      }
    ),
  });

  function handleBoolAction({
    taskId,
    value,
  }: {
    taskId: Id<"tasks">;
    value: CheckedState;
  }) {
    addTaskAction({
      taskId,
      booleanValue: !!value,
    });
  }

  return (
    <Checkbox
      checked={task.completed}
      onCheckedChange={(value) => handleBoolAction({ taskId: task._id, value })}
    />
  );
}
