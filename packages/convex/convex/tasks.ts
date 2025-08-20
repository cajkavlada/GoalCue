import { pick } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";
import { doc, partial } from "convex-helpers/validators";
import { ConvexError } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";
import { rateLimit } from "./utils/rateLimiter";

const tasksSchema = doc(schema, "tasks").fields;

export const getAllExtendedForUserId = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    const tasks = await getManyFrom(db, "tasks", "by_userId", userId);

    const extendedTasks = await Promise.all(
      tasks.map(async (task) => {
        const taskType = await db.get(task.taskTypeId);
        const priorityClass = await db.get(task.priorityClassId);
        if (!taskType || !priorityClass) {
          throw new ConvexError({
            message: "Task or priority class not found",
          });
        }
        return { ...task, taskType, priorityClass };
      })
    );

    return extendedTasks;
  },
});

export const getExtendedById = authedQuery({
  args: {
    taskId: tasksSchema._id,
  },
  handler: async (ctx, { taskId }) => {
    const task = await checkTask(ctx, taskId);

    const taskType = await ctx.db.get(task.taskTypeId);
    const priorityClass = await ctx.db.get(task.priorityClassId);
    return { ...task, taskType, priorityClass };
  },
});

export const create = authedMutation({
  args: pick(tasksSchema, [
    "title",
    "description",
    "taskTypeId",
    "priorityClassId",
    "repetitionId",
    "dueAt",
    "initialNumValue",
    "completedNumValue",
  ]),
  handler: async (ctx, task) => {
    const { db, userId } = ctx;
    await rateLimit(ctx, "createTask");

    const firstPriorityIndex = (
      await db
        .query("tasks")
        .withIndex("by_user_priority", (q) =>
          q.eq("userId", userId).eq("priorityClassId", task.priorityClassId)
        )
        .order("asc")
        .first()
    )?.priorityIndex;

    const taskType = await ctx.db.get(task.taskTypeId);
    if (!taskType) {
      throw new ConvexError({ message: "Task type not found" });
    }

    return await ctx.db.insert("tasks", {
      ...task,
      userId,
      archived: false,
      valueKind: taskType.valueKind,
      priorityIndex: generateKeyBetween(null, firstPriorityIndex),
      completed: false,
      initialNumValue: task.initialNumValue ?? taskType.initialNumValue,
      currentNumValue: task.initialNumValue ?? taskType.initialNumValue,
      completedNumValue: task.completedNumValue ?? taskType.completedNumValue,
      currentEnumOptionId: taskType.initialEnumOptionId,
    });
  },
});

export const update = authedMutation({
  args: {
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
  },
  handler: async (ctx, { taskId, ...task }) => {
    await checkTask(ctx, taskId);
    await rateLimit(ctx, "updateTask");

    await ctx.db.patch(taskId, task);
  },
});

export const archive = authedMutation({
  args: {
    taskId: tasksSchema._id,
  },
  handler: async (ctx, { taskId }) => {
    await checkTask(ctx, taskId);
    await rateLimit(ctx, "deleteTask");

    await ctx.db.patch(taskId, { archived: true });
  },
});

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
