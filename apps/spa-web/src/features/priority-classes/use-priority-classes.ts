import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";

export function usePriorityClasses() {
  const { data: priorityClasses } = useSuspenseQuery(
    convexQuery(api.priorityClasses.getAllForUserId, {})
  );
  return priorityClasses.map(({ i18nKey, name, ...rest }) => ({
    name: i18nKey ? (m[i18nKey as keyof typeof m]() ?? name) : name,
    ...rest,
  }));
}
