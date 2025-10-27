import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";

import { translatePregeneratedItem } from "@/utils/translate-pregenerated-items";

export function useTaskTypes() {
  return useSuspenseQuery({
    ...convexQuery(api.taskTypes.getAllForUserId, {}),
    select: (data) =>
      data.map((taskType) => ({
        ...translatePregeneratedItem(taskType),
        ...("taskTypeEnumOptions" in taskType
          ? {
              taskTypeEnumOptions: taskType.taskTypeEnumOptions?.map(
                translatePregeneratedItem
              ),
            }
          : {}),
      })),
  });
}
