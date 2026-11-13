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
  const additive =
    task.progressMeasure === "time" || task.progressMeasure === "quantity";
  const [value, setValue] = useState(
    additive ? "" : `${task.currentNumValue ?? 0}`
  );

  const addActionMutation = taskActionApi.useAdd({
    task,
    completedAfter,
  });

  function handleNumAction() {
    const numValue = Number(value);
    if (!value.trim() || !Number.isFinite(numValue)) return;
    addActionMutation.mutate({
      taskId: task._id,
      numValue: additive ? (task.currentNumValue ?? 0) + numValue : numValue,
    });
    if (additive) setValue("");
  }

  return (
    <div className="flex min-w-0 max-w-full items-center gap-1">
      {task.progressMeasure && (
        <span className="min-w-0 truncate text-xs">
          {task.currentNumValue ?? 0}/{task.completedNumValue}{" "}
          {task.progressMeasure === "percentage"
            ? "%"
            : task.progressMeasure === "time"
              ? "min"
              : task.progressUnit}
        </span>
      )}
      <Input
        className="h-[30px] w-[80px] shrink-0"
        type="number"
        aria-label={
          additive
            ? `Add progress (${task.progressMeasure === "time" ? "minutes" : (task.progressUnit ?? "quantity")}); current ${task.currentNumValue ?? 0} of ${task.completedNumValue}`
            : "Progress"
        }
        placeholder={
          additive
            ? `+ ${task.progressMeasure === "time" ? "min" : (task.progressUnit ?? "units")}`
            : undefined
        }
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => handleNumAction()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleNumAction();
          }
        }}
      />
    </div>
  );
}
