import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useModal } from "@gc/ui";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

export function usePriorityClasses() {
  return useSuspenseQuery({
    ...convexQuery(api.priorityClasses.getAllForUserId, {}),
    select: (data) => data.map(translatePregeneratedItem),
  });
}

export function useCreatePriorityClass(
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

export function useUpdatePriorityClass() {
  const { closeDrawer } = useModal();
  const convexUpdatePriorityClass = useConvexMutation(
    api.priorityClasses.update
  );
  // optimistic update for reseting the state when update fails
  // commented out because animation is not working as expected
  // .withOptimisticUpdate((localStore, args) => {
  //   if (!args.orderKey) return;
  //   const priorityClasses = localStore.getQuery(
  //     api.priorityClasses.getAllForUserId,
  //     {}
  //   );
  //   if (!priorityClasses) return;
  //   const newPriorityClasses = priorityClasses
  //     .map((priorityClass) => {
  //       if (priorityClass._id === args.priorityClassId) {
  //         return {
  //           ...priorityClass,
  //           orderKey: args.orderKey!,
  //         };
  //       }
  //       return priorityClass;
  //     })
  //     .sort((a, b) => a.orderKey.localeCompare(b.orderKey));

  //   localStore.setQuery(
  //     api.priorityClasses.getAllForUserId,
  //     {},
  //     newPriorityClasses
  //   );
  // });
  return useMutation({
    mutationFn: convexUpdatePriorityClass,
    onSuccess: () => {
      closeDrawer();
    },
  });
}

export function useArchivePriorityClasses() {
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
