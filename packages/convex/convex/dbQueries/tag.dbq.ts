import { ConvexError } from "convex/values";

import { Id } from "../_generated/dataModel";
import { AuthedQueryCtx } from "../utils/authedFunctions";

export function tagQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    getAll() {
      return ctx.db
        .query("tags")
        .withIndex("by_userId_name", (q) =>
          q.eq("userId", ctx.userId).eq("archivedAt", undefined)
        )
        .collect();
    },

    async getOne({ tagId }: { tagId: Id<"tags"> }) {
      const tag = await ctx.db.get(tagId);
      if (!tag) {
        throw new ConvexError({ message: "Tag not found" });
      }
      if (tag.userId !== ctx.userId) {
        throw new ConvexError({ message: "Not authorized for this tag" });
      }
      return tag;
    },
  };
}
