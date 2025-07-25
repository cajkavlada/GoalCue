import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new Error('Not authenticated')
    }
    const tasks = await ctx.db.query("tasks")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .collect()
    return tasks;
  },
});

const rateLimiter = new RateLimiter(components.rateLimiter, {
  createTask: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 20 },
});

export const addTask = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, task) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new Error('Not authenticated')
    }
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "createTask", { key: identity.subject });
    if (!ok) return { retryAfter };
    return await ctx.db.insert("tasks", { 
      ...task,
      userId: identity.subject,
      priorityScore: 0,
      archived: false
    });
  },
});