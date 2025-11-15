import { ConvexError } from "convex/values";

import { Id } from "../_generated/dataModel";
import { AuthedQueryCtx } from "../utils/authedFunctions";

export function taskQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    getAllByStatus({ completedAfter }: { completedAfter?: number }) {
      return ctx.db
        .query("tasks")
        .withIndex("by_user_status_priority", (q) => {
          const baseQuery = q
            .eq("userId", ctx.userId)
            .eq("archivedAt", undefined);
          if (completedAfter === undefined) {
            return baseQuery.eq("completedAt", undefined);
          }
          return baseQuery.gte("completedAt", completedAfter);
        })
        .collect();
    },

    async getOne({ taskId }: { taskId: Id<"tasks"> }) {
      const task = await ctx.db.get(taskId);
      if (!task) {
        throw new ConvexError({ message: "Task not found" });
      }
      if (task.userId !== ctx.userId) {
        throw new ConvexError({ message: "Not authorized for this task" });
      }
      return task;
    },
  };
}
