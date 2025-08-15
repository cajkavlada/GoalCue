import { omit, pick } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";
import { doc, partial } from "convex-helpers/validators";
import { ConvexError } from "convex/values";
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

export const getAllExtendedForUserId = authedQuery({
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
    "initialValue",
    "completedValue",
  ]),
  handler: async (ctx, task) => {
    const { db, userId } = ctx;
    await checkValueTypes(ctx, { ...task, currentValue: task.initialValue });
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

    return await ctx.db.insert("tasks", {
      ...task,
      userId,
      archived: false,
      priorityIndex: generateKeyBetween(null, firstPriorityIndex),
      currentValue: task.initialValue,
    });
  },
});

export const update = authedMutation({
  args: {
    taskId: tasksSchema._id,
    ...partial(
      omit(tasksSchema, ["userId", "_creationTime", "_id", "taskTypeId"])
    ),
  },
  handler: async (ctx, { taskId, ...task }) => {
    const originalTask = await checkTask(ctx, taskId);
    await checkValueTypes(ctx, { ...originalTask, ...task });
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

type TaskWithValues = Pick<
  Doc<"tasks">,
  "initialValue" | "completedValue" | "currentValue" | "taskTypeId"
>;

export async function checkValueTypes(
  ctx: AuthedMutationCtx | AuthedQueryCtx,
  task: TaskWithValues,
  aditionalValue?: Doc<"taskActions">["value"]
) {
  const taskType = await ctx.db.get(task.taskTypeId);
  if (!taskType) {
    throw new ConvexError({ message: "Task type not found" });
  }
  const unit = await ctx.db.get(taskType.unitId);
  if (!unit) {
    throw new ConvexError({ message: "Unit not found" });
  }
  const commonType = typeof task.initialValue;
  if (
    typeof task.completedValue !== commonType ||
    typeof task.currentValue !== commonType ||
    (taskType.initialValue !== undefined &&
      typeof taskType.initialValue !== commonType) ||
    (taskType.completedValue !== undefined &&
      typeof taskType.completedValue !== commonType) ||
    unit.valueType !== commonType ||
    (aditionalValue !== undefined && typeof aditionalValue !== commonType)
  ) {
    throw new ConvexError({ message: "Value types do not match" });
  }
}
