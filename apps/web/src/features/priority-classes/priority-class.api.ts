import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useModal } from "@gc/ui";

import { globalOnErrorMutationHandler } from "@/utils/error-management/global-on-error-mutation-handler";
import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

function useList() {
  return useSuspenseQuery({
    ...convexQuery(api.priorityClasses.list, {}),
    select: (data) => data.map(translatePregeneratedItem),
  });
}

function useCreate(
  onCreate?: (newPriorityClassId: Id<"priorityClasses">) => void
) {
  const { closeDrawer } = useModal();
  const convexCreateUnit = useConvexMutation(api.priorityClasses.create);
  return useMutation({
    mutationFn: convexCreateUnit,
    onSuccess: (newPriorityClassId) => {
      // wait for rerender of parent component to see the new task type
      setTimeout(() => {
        onCreate?.(newPriorityClassId);
      }, 0);
      closeDrawer();
    },
  });
}

function useUpdate({ onError }: { onError?: () => void }) {
  const { closeDrawer } = useModal();
  const convexUpdatePriorityClass = useConvexMutation(
    api.priorityClasses.update
  );
  return useMutation({
    mutationFn: convexUpdatePriorityClass,
    onSuccess: () => {
      closeDrawer();
    },
    onError: (error) => {
      onError?.();
      globalOnErrorMutationHandler(error);
    },
  });
}

function useArchive() {
  const { closeDialog } = useModal();
  const convexArchivePriorityClass = useConvexMutation(
    api.priorityClasses.archive
  );
  return useMutation({
    mutationFn: convexArchivePriorityClass,
    onSuccess: () => {
      closeDialog();
    },
  });
}

export const priorityClassApi = {
  useList,
  useCreate,
  useUpdate,
  useArchive,
};
