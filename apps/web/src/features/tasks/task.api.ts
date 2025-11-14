import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { useModal } from "@gc/ui";

function useUncompletedExtendedList() {
  return useSuspenseQuery(
    convexQuery(api.tasks.getUncompletedExtendedForUserId, {})
  );
}

function useRecentlyCompletedExtendedList({
  completedAfter,
}: {
  completedAfter: number;
}) {
  return useSuspenseQuery(
    convexQuery(api.tasks.getRecentlyCompletedExtendedForUserId, {
      completedAfter,
    })
  );
}

function useCreate() {
  const { closeDrawer } = useModal();
  const convexCreateTask = useConvexMutation(api.tasks.create);
  return useMutation({
    mutationFn: convexCreateTask,
    onSuccess: () => {
      closeDrawer();
    },
  });
}

function useUpdate() {
  const { closeDrawer } = useModal();
  const convexUpdateTask = useConvexMutation(api.tasks.update);
  return useMutation({
    mutationFn: convexUpdateTask,
    onSuccess: () => {
      closeDrawer();
    },
  });
}

function useArchive() {
  const { closeDialog } = useModal();
  const convexArchiveTask = useConvexMutation(api.tasks.archive);
  return useMutation({
    mutationFn: convexArchiveTask,
    onSuccess: () => {
      closeDialog();
    },
  });
}
export const taskApi = {
  useUncompletedExtendedList,
  useRecentlyCompletedExtendedList,
  useCreate,
  useUpdate,
  useArchive,
};
