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
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new Error('Not authenticated')
    }
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "createTodo", { key: "userId" });
    if (!ok) return { retryAfter };
    return await ctx.db.insert("userNotes", { note, userId: identity.subject });
  },
});

export const getMyNotes = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, { count }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new Error('Not authenticated')
    }
    const notes = await ctx.db.query("userNotes")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .order("desc")
      .take(count);
    return notes.reverse();
  },
});
