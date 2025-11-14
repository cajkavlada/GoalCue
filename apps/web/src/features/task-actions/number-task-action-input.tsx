import { useState } from "react";

import { Input } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { taskActionApi } from "./task-action.api";

export function NumberTaskActionInput({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const [value, setValue] = useState(`${task.currentNumValue ?? 0}`);

  const addActionMutation = taskActionApi.useAdd({
    task,
    completedAfter,
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
