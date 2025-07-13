import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addMyNote = mutation({
  args: {
    note: v.string(),
  },
  handler: async (ctx, { note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    await ctx.db.insert("userNotes", { userId, note });
  },
});

export const getMyNotes = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, { count }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const notes = await ctx.db.query("userNotes").filter((q) => q.eq(q.field("userId"), userId)).order("desc").take(count);
    return notes.reverse();
  },
});
