import { useConvexMutation } from "@convex-dev/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { ExtendedTask } from "@gc/validators";

type WithOptimisticUpdate = ReturnType<
  typeof useConvexMutation<typeof api.taskActions.add>
>["withOptimisticUpdate"];

type AddActionUpdater = Parameters<WithOptimisticUpdate>[0];

export function makeAddActionUpdater(
  task: ExtendedTask,
  completedAfter?: number
): AddActionUpdater {
  return (localStore, args) => {
    if (!task.completedAt) {
      const apiRef = api.tasks.getUncompletedExtendedForUserId;
      const tasks = localStore.getQuery(apiRef);

      localStore.setQuery(apiRef, {}, updateTaskInListByAction(tasks, args));
    } else if (completedAfter) {
      const apiRef = api.tasks.getRecentlyCompletedExtendedForUserId;
      const tasks = localStore.getQuery(apiRef, { completedAfter });

      localStore.setQuery(
        apiRef,
        { completedAfter },
        updateTaskInListByAction(tasks, args)
      );
    }
  };
}

function updateTaskInListByAction(
  tasks: ExtendedTask[] | undefined,
  action: {
    taskId: Id<"tasks">;
    numValue?: number | undefined;
    boolValue?: boolean | undefined;
    enumOptionId?: Id<"taskTypeEnumOptions"> | undefined;
  }
) {
  if (!tasks) return tasks;

  return tasks.map((task): ExtendedTask => {
    if (task._id !== action.taskId) return task;

    if (
      task.valueKind === "number" &&
      task.completedNumValue !== undefined &&
      task.initialNumValue !== undefined &&
      action.numValue !== undefined
    ) {
      const completed =
        (task.completedNumValue >= task.initialNumValue &&
          action.numValue >= task.completedNumValue) ||
        (task.completedNumValue <= task.initialNumValue &&
          action.numValue <= task.completedNumValue);
      return {
        ...task,
        completedAt: completed ? Date.now() : undefined,
        currentNumValue: action.numValue,
      };
    }
    if (task.valueKind === "boolean" && action.boolValue !== undefined) {
      return {
        ...task,
        completedAt: action.boolValue ? Date.now() : undefined,
      };
    }
    if (task.valueKind === "enum") {
      return {
        ...task,
        completedAt:
          action.enumOptionId === task.taskType.completedEnumOptionId
            ? Date.now()
            : undefined,
        currentEnumOptionId: action.enumOptionId,
      };
    }
    return task;
  });
}
