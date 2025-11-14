import { Checkbox, CheckedState } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { taskActionApi } from "./task-action.api";

export function BoolTaskActionCheckbox({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const addTaskActionMutation = taskActionApi.useAdd({
    task,
    completedAfter,
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
