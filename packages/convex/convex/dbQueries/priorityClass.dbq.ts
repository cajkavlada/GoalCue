import { ConvexError } from "convex/values";

import { Id } from "../_generated/dataModel";
import { AuthedQueryCtx } from "../utils/authedFunctions";

export function priorityClassQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    getAll() {
      return ctx.db
        .query("priorityClasses")
        .withIndex("by_userId_orderKey", (q) => q.eq("userId", ctx.userId))
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .order("asc")
        .collect();
    },

    async getOne({
      priorityClassId,
    }: {
      priorityClassId: Id<"priorityClasses">;
    }) {
      const priorityClass = await ctx.db.get(priorityClassId);
      if (!priorityClass) {
        throw new ConvexError({ message: "Priority class not found" });
      }
      if (priorityClass.userId !== ctx.userId) {
        throw new ConvexError({
          message: "Not authorized for this priority class",
        });
      }
      return priorityClass;
    },
  };
}
