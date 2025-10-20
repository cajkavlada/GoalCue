import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { Select } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { makeAddActionUpdater } from "./utils/task-action-optimistic-update";

export function EnumTaskActionSelect({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const addTaskActionMutation = useMutation({
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

  function handleEnumAction(value: Id<"taskTypeEnumOptions">) {
    addTaskActionMutation.mutate({
      taskId: task._id,
      enumOptionId: value,
    });
  }

  return (
    <Select
      className="max-h-[30px] w-[150px]"
      options={enumOptions}
      value={task.currentEnumOptionId}
      onValueChange={(value) => handleEnumAction(value)}
    />
  );
}
