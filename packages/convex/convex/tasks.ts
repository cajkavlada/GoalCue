import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const getExtendedTasks = query({
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
    const extendedTasks = await Promise.all(
      tasks.map(async (task) => {
        const taskType = await ctx.db.get(task.taskTypeId);
        const priorityClass = await ctx.db.get(task.priorityClassId);
        return { ...task, taskType, priorityClass };
      })
    );

    return extendedTasks;
  },
});

export const getExtendedTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, { taskId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    const taskType = await ctx.db.get(task.taskTypeId);
    const priorityClass = await ctx.db.get(task.priorityClassId);
    return { ...task, taskType, priorityClass };
  },
});

export const getTaskTypes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    return await ctx.db
      .query("taskTypes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const getPriorityClasses = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const priorityClasses = await ctx.db
      .query("priorityClasses")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    return priorityClasses.sort((a, b) => b.order.localeCompare(a.order));
  },
});

const rateLimiter = new RateLimiter(components.rateLimiter, {
  createTask: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 20 },
  updateTask: { kind: "token bucket", rate: 20, period: MINUTE },
});

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    taskTypeId: v.id("taskTypes"),
    priorityClassId: v.id("priorityClasses"),
    repetitionId: v.optional(v.id("repetitions")),
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
      priorityIndex: generateKeyBetween(null, firstPriorityIndex),
    });
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    taskTypeId: v.optional(v.id("taskTypes")),
    priorityClassId: v.optional(v.id("priorityClasses")),
    repetitionId: v.optional(v.id("repetitions")),
    completedWhen: v.optional(v.union(v.boolean(), v.number())),
    priorityIndex: v.optional(v.string()),
    dueAt: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, { taskId, ...task }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "updateTask", {
      key: identity.subject,
    });
    if (!ok) return { retryAfter };
    return await ctx.db.patch(taskId, task);
  },
});