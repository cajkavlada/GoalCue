import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .collect();
    return tasks;
  },
});

const rateLimiter = new RateLimiter(components.rateLimiter, {
  createTask: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 20 },
});

export const addTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    taskTypeId: v.id("taskTypes"),
    repetitionId: v.optional(v.id("repetitions")),
    priorityClassId: v.id("priorityClasses"),
    completedWhen: v.optional(v.union(v.boolean(), v.number())),
    dueAt: v.optional(v.string()),
  },
  handler: async (ctx, task) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "createTask", {
      key: identity.subject,
    });
    if (!ok) return { retryAfter };

    const taskType = await ctx.db.get(task.taskTypeId);
    if (!taskType) {
      throw new Error("Task type not found");
    }

    const firstPriorityIndex = (
      await ctx.db
        .query("tasks")
        .withIndex("by_user_priority", (q) =>
          q
            .eq("userId", identity.subject)
            .eq("priorityClassId", task.priorityClassId)
        )
        .order("asc")
        .first()
    )?.priorityIndex;

    return await ctx.db.insert("tasks", {
      ...task,
      userId: identity.subject,
      archived: false,
      requiresCompletionInfo: !taskType.completedWhen,
      priorityIndex: generateKeyBetween(null, firstPriorityIndex),
    });
  },
});
