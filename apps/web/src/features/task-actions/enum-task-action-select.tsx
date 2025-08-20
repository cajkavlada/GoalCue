import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { Select } from "@gc/ui";

export function EnumTaskActionSelect({
  task,
}: {
  task: Doc<"tasks"> & { enumOptions?: Doc<"taskTypeEnumOptions">[] };
}) {
  const { mutate: addTaskAction } = useMutation({
    mutationFn: useConvexMutation(api.taskActions.add).withOptimisticUpdate(
      (localStore, args) => {
        const tasks = localStore.getQuery(api.tasks.getAllExtendedForUserId);
        if (!tasks) return;

        const updatedTasks = tasks.map((task) => {
          if (task._id === args.taskId) {
            return {
              ...task,
              completed:
                args.enumOptionId === task.taskType.completedEnumOptionId,
              currentEnumOptionId: args.enumOptionId,
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

  if (!task.currentEnumOptionId) {
    return null;
  }

  const enumOptions =
    task.enumOptions?.map((option) => ({
      label: option.name,
      value: option._id,
    })) ?? [];

  function handleEnumAction({
    taskId,
    value,
  }: {
    taskId: Id<"tasks">;
    value: Id<"taskTypeEnumOptions">;
  }) {
    addTaskAction({
      taskId,
      enumOptionId: value,
    });
  }

  return (
    <Select
      options={enumOptions}
      value={task.currentEnumOptionId}
      onValueChange={(value) => handleEnumAction({ taskId: task._id, value })}
    />
  );
}
