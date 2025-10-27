import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

export function usePriorityClasses() {
  return useSuspenseQuery({
    ...convexQuery(api.priorityClasses.getAllForUserId, {}),
    select: (data) => data.map(translatePregeneratedItem),
  });
}
