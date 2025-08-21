import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { ExtendedTask } from "@gc/convex";
import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { Select } from "@gc/ui";

import { makeAddActionUpdater } from "./utils/task-action-optimistic-update";

export function EnumTaskActionSelect({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const { mutate: addTaskAction } = useMutation({
    mutationFn: useConvexMutation(api.taskActions.add).withOptimisticUpdate(
      makeAddActionUpdater(task, completedAfter)
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
