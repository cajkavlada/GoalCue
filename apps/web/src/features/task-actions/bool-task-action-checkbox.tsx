import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { ExtendedTask } from "@gc/convex";
import { api } from "@gc/convex/api";
import { Checkbox, CheckedState } from "@gc/ui";

import { makeAddActionUpdater } from "./utils/task-action-optimistic-update";

export function BoolTaskActionCheckbox({
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

  function handleBoolAction(value: CheckedState) {
    addTaskAction({
      taskId: task._id,
      boolValue: !!value,
    });
  }

  return (
    <Checkbox
      checked={task.completed}
      onCheckedChange={(value) => handleBoolAction(value)}
    />
  );
}
