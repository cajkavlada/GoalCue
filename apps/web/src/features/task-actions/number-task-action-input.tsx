import { useState } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { Input } from "@gc/ui";

export function NumberTaskActionInput({ task }: { task: Doc<"tasks"> }) {
  const [value, setValue] = useState(task.currentNumValue ?? 0);

  const { mutate: addTaskAction } = useMutation({
    mutationFn: useConvexMutation(api.taskActions.add).withOptimisticUpdate(
      (localStore, args) => {
        const tasks = localStore.getQuery(api.tasks.getAllExtendedForUserId);
        if (!tasks) return;

        const updatedTasks = tasks.map((task) => {
          if (
            task._id === args.taskId &&
            task.completedNumValue !== undefined &&
            task.initialNumValue !== undefined &&
            args.numValue !== undefined
          ) {
            return {
              ...task,
              completed:
                (task.completedNumValue >= task.initialNumValue &&
                  args.numValue >= task.completedNumValue) ||
                (task.completedNumValue <= task.initialNumValue &&
                  args.numValue <= task.completedNumValue),
              currentNumValue: args.numValue,
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

  function handleNumAction({
    taskId,
    value,
  }: {
    taskId: Id<"tasks">;
    value: number;
  }) {
    addTaskAction({
      taskId,
      numValue: value,
    });
  }

  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => setValue(Number(e.target.value))}
      onBlur={() => handleNumAction({ taskId: task._id, value })}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleNumAction({ taskId: task._id, value });
        }
      }}
    />
  );
}
