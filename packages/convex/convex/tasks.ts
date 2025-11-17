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
  tagQueries,
  tagRelationsUpdate,
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
  handler: async (ctx, taskArgs) => {
    const parsedDueAt = taskArgs.dueAt ? new Date(taskArgs.dueAt) : undefined;
    await zodParse(createTaskZodSchema, {
      ...taskArgs,
      dueAt: parsedDueAt,
    });

    const taskType = await taskTypeQueries({ ctx }).getOne({
      taskTypeId: taskArgs.taskTypeId,
    });

    await zodParse(taskWithCorrectValuesSchema, {
      ...taskArgs,
      valueKind: taskType.valueKind,
      dueAt: parsedDueAt,
    });

    const { tags, ...rawTask } = taskArgs;

    const newTaskId = await ctx.db.insert("tasks", {
      ...rawTask,
      userId: ctx.userId,
      valueKind: taskType.valueKind,
      priorityIndex: generateKeyBetween(
        null,
        await getFirstPriorityIndexInClass(ctx, rawTask.priorityClassId)
      ),
      initialNumValue: rawTask.initialNumValue ?? taskType.initialNumValue,
      currentNumValue: rawTask.initialNumValue ?? taskType.initialNumValue,
      completedNumValue:
        rawTask.completedNumValue ?? taskType.completedNumValue,
      currentEnumOptionId: taskType.initialEnumOptionId,
    });

    for (const tagId of tags) {
      await tagQueries({ ctx }).getOne({ tagId });
      await ctx.db.insert("tagTasks", { taskId: newTaskId, tagId });
    }

    return newTaskId;
  },
});

export const update = authedMutation({
  args: updateTaskConvexSchema,
  rateLimit: { name: "updateTask" },
  handler: async (ctx, { taskId, ...taskArgs }) => {
    await taskQueries({ ctx }).getOne({ taskId });
    const parsedDueAt = taskArgs.dueAt ? new Date(taskArgs.dueAt) : undefined;
    await zodParse(updateTaskZodSchema, {
      ...taskArgs,
      dueAt: parsedDueAt,
    });
    const { tags, ...rawTask } = taskArgs;

    await tagRelationsUpdate({ ctx }).updateTagsForTask({
      taskId,
      newTags: tags,
    });

    await ctx.db.patch(taskId, {
      ...rawTask,
      dueAt: taskArgs.dueAt ?? undefined,
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
  const tags = await tagQueries({ ctx }).getAllForTask({ taskId: task._id });

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
    tags,
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
