import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Checkbox, CheckedState } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { makeAddActionUpdater } from "./utils/task-action-optimistic-update";

export function BoolTaskActionCheckbox({
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

  function handleBoolAction(value: CheckedState) {
    addTaskActionMutation.mutate({
      taskId: task._id,
      boolValue: !!value,
    });
  }

  return (
    <Checkbox
      checked={!!task.completedAt}
      onCheckedChange={(value) => handleBoolAction(value)}
    />
  );
}
