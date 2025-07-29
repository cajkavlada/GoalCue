import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { getManyFrom } from "convex-helpers/server/relationships";
import { v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import { components } from "./_generated/api";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const getExtendedTasks = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    const tasks = await getManyFrom(db, "tasks", "by_userId", userId);

    const extendedTasks = await Promise.all(
      tasks.map(async (task) => {
        const taskType = await db.get(task.taskTypeId);
        const priorityClass = await db.get(task.priorityClassId);
        return { ...task, taskType, priorityClass };
      })
    );

    return extendedTasks;
  },
});

export const getExtendedTask = authedQuery({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async ({ db, userId }, { taskId }) => {
    const task = await db.get(taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Not authorized or task not found");
    }
    const taskType = await db.get(task.taskTypeId);
    const priorityClass = await db.get(task.priorityClassId);
    return { ...task, taskType, priorityClass };
  },
});

export const getTaskTypes = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    return await getManyFrom(db, "taskTypes", "by_userId", userId);
  },
});

export const getPriorityClasses = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    const priorityClasses = await getManyFrom(
      db,
      "priorityClasses",
      "by_userId",
      userId
    );
    return priorityClasses.sort((a, b) => b.order.localeCompare(a.order));
  },
});

const rateLimiter = new RateLimiter(components.rateLimiter, {
  createTask: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 20 },
  updateTask: { kind: "token bucket", rate: 20, period: MINUTE },
});

export const createTask = authedMutation({
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
    const { db, userId } = ctx;
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "createTask", {
      key: userId,
    });
    if (!ok) return { retryAfter };

    const firstPriorityIndex = (
      await db
        .query("tasks")
        .withIndex("by_user_priority", (q) =>
          q.eq("userId", userId).eq("priorityClassId", task.priorityClassId)
        )
        .order("asc")
        .first()
    )?.priorityIndex;

    return await ctx.db.insert("tasks", {
      ...task,
      userId,
      archived: false,
      priorityIndex: generateKeyBetween(null, firstPriorityIndex),
    });
  },
});

export const updateTask = authedMutation({
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
    const { db, userId } = ctx;
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "updateTask", {
      key: userId,
    });
    if (!ok) return { retryAfter };

    const originalTask = await db.get(taskId);
    if (!originalTask || originalTask.userId !== userId) {
      throw new Error("Not authorized or task not found");
    }

    return await db.patch(taskId, task);
  },
});
