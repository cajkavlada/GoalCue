import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useModal } from "@gc/ui";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

function useList() {
  return useSuspenseQuery({
    ...convexQuery(api.tags.getAll, {}),
    select: (data) => data.map(translatePregeneratedItem),
  });
}

function useCreate(onCreate?: (newTagId: Id<"tags">) => void) {
  const { closeDrawer } = useModal();
  const convexCreateTag = useConvexMutation(api.tags.create);
  return useMutation({
    mutationFn: convexCreateTag,
    onSuccess: (newTagId) => {
      setTimeout(() => {
        onCreate?.(newTagId);
      }, 0);
      closeDrawer();
    },
  });
}

function useUpdate() {
  const { closeDrawer } = useModal();
  const convexUpdateTag = useConvexMutation(api.tags.update);
  return useMutation({
    mutationFn: convexUpdateTag,
    onSuccess: () => {
      closeDrawer();
    },
  });
}

function useArchive() {
  const { closeDialog } = useModal();
  const convexArchiveTag = useConvexMutation(api.tags.archive);
  return useMutation({
    mutationFn: convexArchiveTag,
    onSuccess: () => {
      closeDialog();
    },
  });
}

export const tagApi = {
  useList,
  useCreate,
  useUpdate,
  useArchive,
};
