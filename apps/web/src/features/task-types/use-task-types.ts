import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useModal } from "@gc/ui";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

const convexGetTaskTypes = convexQuery(api.taskTypes.getAllForUserId, {});

export function useTaskTypes() {
  return useSuspenseQuery({
    ...convexGetTaskTypes,
    select: (data) =>
      data.map((taskType) => ({
        ...translatePregeneratedItem(taskType),
        ...("taskTypeEnumOptions" in taskType
          ? {
              taskTypeEnumOptions: taskType.taskTypeEnumOptions?.map(
                translatePregeneratedItem
              ),
            }
          : {}),
      })),
  });
}

export function useCreateTaskType(
  onCreate?: (newTaskTypeId: Id<"taskTypes">) => void
) {
  const { closeDrawer } = useModal();
  const convexCreateTaskType = useConvexMutation(api.taskTypes.create);

  return useMutation({
    mutationFn: convexCreateTaskType,
    onSuccess: (newTaskTypeId) => {
      // wait for rerender of parent component to see the new task type
      setTimeout(() => {
        onCreate?.(newTaskTypeId);
      }, 0);
      closeDrawer();
    },
  });
}

export function useUpdateTaskType() {
  const { closeDrawer } = useModal();
  const convexUpdateTaskType = useConvexMutation(api.taskTypes.update);

  return useMutation({
    mutationFn: convexUpdateTaskType,
    onSuccess: () => {
      closeDrawer();
    },
  });
}
