import { ConvexError, v } from "convex/values";

import {
  createTaskTypeConvexSchema,
  createTaskTypeZodSchema,
  taskTypeConvexSchema,
  zodParse,
} from "@gc/validators";

import { Id } from "./_generated/dataModel";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";

export const getAllForUserId = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    return await db
      .query("taskTypes")
      .withIndex("by_userId", (q) =>
        q.eq("userId", userId).eq("archivedAt", undefined)
      )
      .collect();
  },
});

export const create = authedMutation({
  args: createTaskTypeConvexSchema,
  rateLimit: { name: "createTaskType" },
  handler: async (ctx, taskType) => {
    await zodParse(createTaskTypeZodSchema, taskType);
    return await ctx.db.insert("taskTypes", {
      ...taskType,
      userId: ctx.userId,
    });
  },
});

export const archive = authedMutation({
  args: {
    taskTypeIds: v.array(taskTypeConvexSchema.fields._id),
  },
  rateLimit: { name: "archiveTaskType" },
  handler: async (ctx, { taskTypeIds }) => {
    await Promise.all(
      taskTypeIds.map((taskTypeId) => checkTaskType(ctx, taskTypeId))
    );
    const now = Date.now();
    for (const taskTypeId of taskTypeIds) {
      await ctx.db.patch(taskTypeId, { archivedAt: now });
    }
  },
});

async function checkTaskType(
  ctx: AuthedMutationCtx | AuthedQueryCtx,
  taskTypeId: Id<"taskTypes">
) {
  const { db, userId } = ctx;
  const taskType = await db.get(taskTypeId);
  if (!taskType) {
    throw new ConvexError({ message: "Task type not found" });
  }
  if (taskType.userId !== userId) {
    throw new ConvexError({ message: "Not authorized for this task type" });
  }
  return taskType;
}
