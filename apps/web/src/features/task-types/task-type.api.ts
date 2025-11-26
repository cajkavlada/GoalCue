import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useModal } from "@gc/ui";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

function useList() {
  return useSuspenseQuery({
    ...convexQuery(api.taskTypes.listExtended),
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

function useCreate(onCreate?: (newTaskTypeId: Id<"taskTypes">) => void) {
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

function useUpdate() {
  const { closeDrawer } = useModal();
  const convexUpdateTaskType = useConvexMutation(api.taskTypes.update);

  return useMutation({
    mutationFn: convexUpdateTaskType,
    onSuccess: () => {
      closeDrawer();
    },
  });
}

function useArchive() {
  const { closeDialog } = useModal();
  const convexArchiveTaskType = useConvexMutation(api.taskTypes.archive);
  return useMutation({
    mutationFn: convexArchiveTaskType,
    onSuccess: () => {
      closeDialog();
    },
  });
}

export const taskTypeApi = {
  useList,
  useCreate,
  useUpdate,
  useArchive,
};
