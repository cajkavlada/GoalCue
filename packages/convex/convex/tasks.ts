import { v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import {
  createTaskConvexSchema,
  createTaskZodSchema,
  extendedTaskConvexSchema,
  taskConvexSchema,
  taskWithCorrectValuesSchema,
  updateTaskConvexSchema,
  updateTaskZodSchema,
  zodParse,
} from "@gc/validators";

import { Doc, Id } from "./_generated/dataModel";
import {
  priorityClassQueries,
  taskQueries,
  taskTypeEnumOptionQueries,
  taskTypeQueries,
} from "./dbQueries";
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
    const tasks = await taskQueries({ ctx }).getAllByStatus({
      completedAfter: undefined,
    });

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
    const tasks = await taskQueries({ ctx }).getAllByStatus({
      completedAfter,
    });

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
    const task = await taskQueries({ ctx }).getOne({ taskId });
    return await getExtendedTaskInfo(ctx, task);
  },
});

export const create = authedMutation({
  args: createTaskConvexSchema,
  rateLimit: { name: "createTask" },
  handler: async (ctx, task) => {
    const parsedDueAt = task.dueAt ? new Date(task.dueAt) : undefined;
    await zodParse(createTaskZodSchema, {
      ...task,
      dueAt: parsedDueAt,
    });

    const taskType = await taskTypeQueries({ ctx }).getOne({
      taskTypeId: task.taskTypeId,
    });

    await zodParse(taskWithCorrectValuesSchema, {
      ...task,
      valueKind: taskType.valueKind,
      dueAt: parsedDueAt,
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
  args: updateTaskConvexSchema,
  rateLimit: { name: "updateTask" },
  handler: async (ctx, { taskId, ...task }) => {
    await taskQueries({ ctx }).getOne({ taskId });
    const parsedDueAt = task.dueAt ? new Date(task.dueAt) : undefined;
    await zodParse(updateTaskZodSchema, {
      ...task,
      dueAt: parsedDueAt,
    });
    await ctx.db.patch(taskId, {
      ...task,
      dueAt: task.dueAt ?? undefined,
    });
  },
});

export const archive = authedMutation({
  args: {
    taskIds: v.array(taskConvexSchema._id),
  },
  rateLimit: { name: "archiveTask" },
  handler: async (ctx, { taskIds }) => {
    await Promise.all(
      taskIds.map((taskId) => taskQueries({ ctx }).getOne({ taskId }))
    );
    const now = Date.now();
    for (const taskId of taskIds) {
      await ctx.db.patch(taskId, { archivedAt: now });
    }
  },
});

async function getExtendedTaskInfo(ctx: AuthedQueryCtx, task: Doc<"tasks">) {
  const taskType = await taskTypeQueries({ ctx }).getOne({
    taskTypeId: task.taskTypeId,
  });
  const priorityClass = await priorityClassQueries({ ctx }).getOne({
    priorityClassId: task.priorityClassId,
  });

  let enumOptions: Doc<"taskTypeEnumOptions">[] | undefined;
  if (taskType.valueKind === "enum") {
    enumOptions = await taskTypeEnumOptionQueries({ ctx }).getAllForTaskType({
      taskTypeId: task.taskTypeId,
    });
  }
  return {
    ...task,
    taskType,
    priorityClass,
    ...(enumOptions ? { enumOptions } : {}),
  };
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
