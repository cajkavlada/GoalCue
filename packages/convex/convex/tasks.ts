import { getManyFrom } from "convex-helpers/server/relationships";
import { ConvexError, v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import {
  createTaskConvexSchema,
  createTaskZodSchema,
  extendedTaskConvexSchema,
  taskConvexSchema,
  taskWithCorrectValuesSchema,
  updateSchema,
  updateTaskZodSchema,
  zodParse,
} from "@gc/validators";

import { Doc, Id } from "./_generated/dataModel";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";

export const getUncompletedExtendedForUserId = authedQuery({
  args: {},
  returns: v.array(extendedTaskConvexSchema),
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_status_priority", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("archivedAt", undefined)
          .eq("completedAt", undefined)
      )
      .collect();

    const extendedTasks = await Promise.all(
      tasks.map(async (task) => {
        return await getExtendedTaskInfo(ctx, task);
      })
    );
    return extendedTasks;
  },
});

export const getRecentlyCompletedExtendedForUserId = authedQuery({
  args: { completedAfter: v.number() },
  returns: v.array(extendedTaskConvexSchema),
  handler: async (ctx, { completedAfter }) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_status_priority", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("archivedAt", undefined)
          .gte("completedAt", completedAfter)
      )
      .collect();

    const extendedTasks = await Promise.all(
      tasks.map(async (task) => {
        return await getExtendedTaskInfo(ctx, task);
      })
    );
    return extendedTasks;
  },
});

export const getExtendedById = authedQuery({
  args: {
    taskId: taskConvexSchema._id,
  },
  returns: extendedTaskConvexSchema,
  handler: async (ctx, { taskId }) => {
    const task = await checkTask(ctx, taskId);
    return await getExtendedTaskInfo(ctx, task);
  },
});

export const create = authedMutation({
  args: createTaskConvexSchema,
  rateLimit: { name: "createTask" },
  handler: async (ctx, task) => {
    await zodParse(createTaskZodSchema, task);
    const taskType = await ctx.db.get(task.taskTypeId);
    if (!taskType) {
      throw new ConvexError({ message: "Task type not found" });
    }

    await zodParse(taskWithCorrectValuesSchema, {
      ...task,
      valueKind: taskType.valueKind,
    });

    return await ctx.db.insert("tasks", {
      ...task,
      userId: ctx.userId,
      valueKind: taskType.valueKind,
      priorityIndex: generateKeyBetween(
        null,
        await getFirstPriorityIndexInClass(ctx, task.priorityClassId)
      ),
      initialNumValue: task.initialNumValue ?? taskType.initialNumValue,
      currentNumValue: task.initialNumValue ?? taskType.initialNumValue,
      completedNumValue: task.completedNumValue ?? taskType.completedNumValue,
      currentEnumOptionId: taskType.initialEnumOptionId,
    });
  },
});

export const update = authedMutation({
  args: updateSchema,
  rateLimit: { name: "updateTask" },
  handler: async (ctx, { taskId, ...task }) => {
    await checkTask(ctx, taskId);
    await zodParse(updateTaskZodSchema, task);

    await ctx.db.patch(taskId, task);
  },
});

export const archive = authedMutation({
  args: {
    taskId: taskConvexSchema._id,
  },
  rateLimit: { name: "archiveTask" },
  handler: async (ctx, { taskId }) => {
    await checkTask(ctx, taskId);

    await ctx.db.patch(taskId, { archivedAt: Date.now() });
  },
});

async function getExtendedTaskInfo(ctx: AuthedQueryCtx, task: Doc<"tasks">) {
  const taskType = await ctx.db.get(task.taskTypeId);
  const priorityClass = await ctx.db.get(task.priorityClassId);
  if (!taskType || !priorityClass) {
    throw new ConvexError({
      message: "Task type or priority class not found",
    });
  }
  let enumOptions: Doc<"taskTypeEnumOptions">[] | undefined;
  if (taskType.valueKind === "enum") {
    enumOptions = await getManyFrom(
      ctx.db,
      "taskTypeEnumOptions",
      "by_taskTypeId_orderKey",
      task.taskTypeId,
      "taskTypeId"
    );
  }
  return {
    ...task,
    taskType,
    priorityClass,
    ...(enumOptions ? { enumOptions } : {}),
  };
}

export async function checkTask(
  ctx: AuthedMutationCtx | AuthedQueryCtx,
  taskId: Id<"tasks">
) {
  const { db, userId } = ctx;
  const task = await db.get(taskId);
  if (!task) {
    throw new ConvexError({ message: "Task not found" });
  }
  if (task.userId !== userId) {
    throw new ConvexError({ message: "Not authorized for this task" });
  }
  return task;
}

async function getFirstPriorityIndexInClass(
  ctx: AuthedMutationCtx,
  priorityClassId: Id<"priorityClasses">
) {
  return (
    await ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) =>
        q.eq("userId", ctx.userId).eq("priorityClassId", priorityClassId)
      )
      .order("asc")
      .first()
  )?.priorityIndex;
}
