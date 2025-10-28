import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

export function useUnits() {
  return useSuspenseQuery({
    ...convexQuery(api.units.getAllForUserId, {}),
    select: (data) => data.map(translatePregeneratedItem),
  });
}
