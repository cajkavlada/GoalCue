import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";

export function useTaskTypes() {
  return useSuspenseQuery({
    ...convexQuery(api.taskTypes.getAllForUserId, {}),
    select: (data) =>
      data.map(({ i18nKey, name, ...rest }) => ({
        name: i18nKey
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((m as Record<string, any>)[i18nKey]?.() ?? name)
          : name,
        ...rest,
      })),
  });
}
