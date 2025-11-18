import { ConvexError } from "convex/values";

import { Id } from "../_generated/dataModel";
import { AuthedQueryCtx } from "../utils/authedFunctions";

export function unitQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    list() {
      return ctx.db
        .query("units")
        .withIndex("by_userId", (q) =>
          q.eq("userId", ctx.userId).eq("archivedAt", undefined)
        )
        .collect();
    },

    async getById({ unitId }: { unitId: Id<"units"> }) {
      const unit = await ctx.db.get(unitId);
      if (!unit) {
        throw new ConvexError({ message: "Unit not found" });
      }
      if (unit.userId !== ctx.userId) {
        throw new ConvexError({ message: "Not authorized for this unit" });
      }
      return unit;
    },
  };
}
