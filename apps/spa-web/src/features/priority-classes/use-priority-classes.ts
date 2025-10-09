import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";

export function usePriorityClasses() {
  const { data: priorityClasses } = useSuspenseQuery(
    convexQuery(api.priorityClasses.getAllForUserId, {})
  );
  return priorityClasses.map(({ i18nKey, name, ...rest }) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: i18nKey ? ((m as Record<string, any>)[i18nKey]?.() ?? name) : name,
    ...rest,
  }));
}
