import { pick } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";
import { doc, partial } from "convex-helpers/validators";
import { ConvexError, Infer, v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";
import { rateLimit } from "./utils/rateLimiter";

const tasksSchema = doc(schema, "tasks").fields;

const extendedTaskSchema = v.object({
  ...tasksSchema,
  taskType: doc(schema, "taskTypes"),
  priorityClass: doc(schema, "priorityClasses"),
  enumOptions: v.optional(v.array(doc(schema, "taskTypeEnumOptions"))),
});

export type ExtendedTask = Infer<typeof extendedTaskSchema>;

export const getUncompletedExtendedForUserId = authedQuery({
  args: {},
  returns: v.array(extendedTaskSchema),
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_status_priority", (q) =>
        q.eq("userId", ctx.userId).eq("completed", false)
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
  returns: v.array(extendedTaskSchema),
  handler: async (ctx, { completedAfter }) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_status_valueUpdatedAt_priority", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("completed", true)
          .gte("valueUpdatedAt", completedAfter)
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
    taskId: tasksSchema._id,
  },
  returns: extendedTaskSchema,
  handler: async (ctx, { taskId }) => {
    const task = await checkTask(ctx, taskId);
    return await getExtendedTaskInfo(ctx, task);
  },
});

const createSchema = v.object(
  pick(tasksSchema, [
    "title",
    "description",
    "taskTypeId",
    "priorityClassId",
    "repetitionId",
    "dueAt",
    "initialNumValue",
    "completedNumValue",
  ])
);

export type CreateTaskArgs = Infer<typeof createSchema>;

export const create = authedMutation({
  args: createSchema,
  handler: async (ctx, task) => {
    await rateLimit(ctx, "createTask");
    const taskType = await ctx.db.get(task.taskTypeId);
    if (!taskType) {
      throw new ConvexError({ message: "Task type not found" });
    }

    if (
      taskType.valueKind === "number" &&
      (task.initialNumValue === undefined ||
        task.completedNumValue === undefined)
    ) {
      throw new ConvexError({
        message:
          "Initial and completed number values are required for number tasks",
      });
    }

    return await ctx.db.insert("tasks", {
      ...task,
      userId: ctx.userId,
      archived: false,
      valueKind: taskType.valueKind,
      priorityIndex: generateKeyBetween(
        null,
        await getFirstPriorityIndexInClass(ctx, task.priorityClassId)
      ),
      completed: false,
      initialNumValue: task.initialNumValue ?? taskType.initialNumValue,
      currentNumValue: task.initialNumValue ?? taskType.initialNumValue,
      completedNumValue: task.completedNumValue ?? taskType.completedNumValue,
      currentEnumOptionId: taskType.initialEnumOptionId,
    });
  },
});

const updateSchema = v.object({
  taskId: tasksSchema._id,
  ...partial(
    pick(tasksSchema, [
      "title",
      "description",
      "priorityClassId",
      "priorityIndex",
      "repetitionId",
      "dueAt",
      "initialNumValue",
      "completedNumValue",
    ])
  ),
});

export type UpdateTaskArgs = Infer<typeof updateSchema>;

export const update = authedMutation({
  args: updateSchema,
  handler: async (ctx, { taskId, ...task }) => {
    await rateLimit(ctx, "updateTask");
    await checkTask(ctx, taskId);

    await ctx.db.patch(taskId, task);
  },
});

export const archive = authedMutation({
  args: {
    taskId: tasksSchema._id,
  },
  handler: async (ctx, { taskId }) => {
    await rateLimit(ctx, "deleteTask");
    await checkTask(ctx, taskId);

    await ctx.db.patch(taskId, { archived: true });
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
      .withIndex("by_user_status_priority", (q) =>
        q
          .eq("userId", ctx.userId)
          .eq("completed", true)
          .eq("priorityClassId", priorityClassId)
      )
      .order("asc")
      .first()
  )?.priorityIndex;
}
