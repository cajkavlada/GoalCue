import { ConvexError } from "convex/values";

import { Id } from "../_generated/dataModel";
import { AuthedQueryCtx } from "../utils/authedFunctions";

export function taskTypeQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    list() {
      return ctx.db
        .query("taskTypes")
        .withIndex("by_userId", (q) =>
          q.eq("userId", ctx.userId).eq("archivedAt", undefined)
        )
        .collect();
    },

    async getById({ taskTypeId }: { taskTypeId: Id<"taskTypes"> }) {
      const taskType = await ctx.db.get(taskTypeId);
      if (!taskType) {
        throw new ConvexError({ message: "Task type not found" });
      }
      if (taskType.userId !== ctx.userId) {
        throw new ConvexError({ message: "Not authorized for this task type" });
      }
      return taskType;
    },
  };
}
