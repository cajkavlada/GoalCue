import { Id } from "../_generated/dataModel";
import { AuthedQueryCtx } from "../utils/authedFunctions";

export function taskTypeEnumOptionQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    getAllForTaskType({ taskTypeId }: { taskTypeId: Id<"taskTypes"> }) {
      return ctx.db
        .query("taskTypeEnumOptions")
        .withIndex("by_taskTypeId_orderKey", (q) =>
          q.eq("taskTypeId", taskTypeId)
        )
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .collect();
    },
  };
}
