import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  createTodo: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 20 },
  updateTodo: { kind: "token bucket", rate: 20, period: MINUTE },
  deleteTodo: { kind: "token bucket", rate: 30, period: MINUTE },
});

export const addMyNote = mutation({
  args: {
    note: v.string(),
  },
  handler: async (ctx, { note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "createTodo", { key: userId});
    if (!ok) return { retryAfter };
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
