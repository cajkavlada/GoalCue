import { useState } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { ExtendedTask } from "@gc/convex";
import { api } from "@gc/convex/api";
import { Input } from "@gc/ui";

import { makeAddActionUpdater } from "./utils/task-action-optimistic-update";

export function NumberTaskActionInput({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const [value, setValue] = useState(`${task.currentNumValue ?? 0}`);

  const { mutate: addTaskAction } = useMutation({
    mutationFn: useConvexMutation(api.taskActions.add).withOptimisticUpdate(
      makeAddActionUpdater(task, completedAfter)
    ),
  });

  function handleNumAction() {
    const numValue = Number(value);
    if (isNaN(numValue)) return;
    addTaskAction({
      taskId: task._id,
      numValue,
    });
  }

  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => handleNumAction()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleNumAction();
        }
      }}
    />
  );
}
