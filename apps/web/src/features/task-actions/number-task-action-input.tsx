import { useState } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Input } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { makeAddActionUpdater } from "./utils/task-action-optimistic-update";

export function NumberTaskActionInput({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const [value, setValue] = useState(`${task.currentNumValue ?? 0}`);

  const addActionMutation = useMutation({
    mutationFn: useConvexMutation(api.taskActions.add).withOptimisticUpdate(
      makeAddActionUpdater(task, completedAfter)
    ),
  });

  function handleNumAction() {
    const numValue = Number(value);
    if (isNaN(numValue)) return;
    addActionMutation.mutate({
      taskId: task._id,
      numValue,
    });
  }

  return (
    <Input
      className="h-[30px] w-[80px]"
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
