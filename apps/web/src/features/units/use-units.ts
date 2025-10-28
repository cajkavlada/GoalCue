import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useModal } from "@gc/ui";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

export function useUnits() {
  return useSuspenseQuery({
    ...convexQuery(api.units.getAllForUserId, {}),
    select: (data) => data.map(translatePregeneratedItem),
  });
}

export function useCreateUnit(onCreate?: (newUnitId: Id<"units">) => void) {
  const { closeDrawer } = useModal();
  const convexCreateUnit = useConvexMutation(api.units.create);
  return useMutation({
    mutationFn: convexCreateUnit,
    onSuccess: (newUnitId) => {
      // wait for rerender of parent component to see the new task type
      setTimeout(() => {
        onCreate?.(newUnitId);
      }, 0);
      closeDrawer();
    },
  });
}

export function useUpdateUnit() {
  const { closeDrawer } = useModal();
  const convexUpdateUnit = useConvexMutation(api.units.update);
  return useMutation({
    mutationFn: convexUpdateUnit,
    onSuccess: () => {
      closeDrawer();
    },
  });
}
