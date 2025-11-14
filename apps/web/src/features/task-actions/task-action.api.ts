import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { ExtendedTask } from "@gc/validators";

import { makeAddActionUpdater } from "./utils/task-action-optimistic-update";

function useAdd({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const convexAddTaskAction = useConvexMutation(
    api.taskActions.add
  ).withOptimisticUpdate(makeAddActionUpdater(task, completedAfter));

  return useMutation({
    mutationFn: convexAddTaskAction,
  });
}

function useAddToCompleted() {
  const convexAddToCompletedTaskAction = useConvexMutation(
    api.taskActions.addToCompleted
  );

  return useMutation({
    mutationFn: convexAddToCompletedTaskAction,
  });
}

function useAddToInitial() {
  const convexAddToInitialTaskAction = useConvexMutation(
    api.taskActions.addToInitial
  );

  return useMutation({
    mutationFn: convexAddToInitialTaskAction,
  });
}

export const taskActionApi = {
  useAdd,
  useAddToCompleted,
  useAddToInitial,
};
