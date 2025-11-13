import { ConvexError, v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import {
  createPriorityClassConvexSchema,
  getCreatePriorityClassZodSchema,
  getUpdatePriorityClassZodSchema,
  priorityClassConvexSchema,
  updatePriorityClassConvexSchema,
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
  returns: v.array(priorityClassConvexSchema),
  handler: async ({ db, userId }) => {
    const priorityClasses = await db
      .query("priorityClasses")
      .withIndex("by_userId_orderKey", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .order("asc")
      .collect();
    return priorityClasses;
  },
});

export const create = authedMutation({
  args: createPriorityClassConvexSchema,
  rateLimit: { name: "createPriorityClass" },
  handler: async ({ db, userId }, args) => {
    const priorityClasses = await db
      .query("priorityClasses")
      .withIndex("by_userId_orderKey", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .order("asc")
      .collect();

    if (priorityClasses.length === 0) {
      throw new ConvexError({ message: "No priority classes found" });
    }

    await zodParse(
      getCreatePriorityClassZodSchema({
        existingPriorityClasses: priorityClasses,
      }),
      args
    );
    return await db.insert("priorityClasses", {
      ...args,
      userId,
      orderKey: generateKeyBetween(null, priorityClasses[0]?.orderKey),
    });
  },
});

export const update = authedMutation({
  args: updatePriorityClassConvexSchema,
  rateLimit: { name: "updatePriorityClass" },
  handler: async (ctx, { priorityClassId, ...priorityClassArgs }) => {
    await checkPriorityClass(ctx, priorityClassId);
    const priorityClasses = await ctx.db
      .query("priorityClasses")
      .withIndex("by_userId_orderKey", (q) => q.eq("userId", ctx.userId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .order("asc")
      .collect();
    await zodParse(
      getUpdatePriorityClassZodSchema({
        existingPriorityClasses: priorityClasses,
        currentPriorityClassId: priorityClassId,
      }),
      priorityClassArgs
    );
    await ctx.db.patch(priorityClassId, {
      ...priorityClassArgs,
    });
  },
});

export const archive = authedMutation({
  args: {
    priorityClassIds: v.array(priorityClassConvexSchema.fields._id),
  },
  rateLimit: { name: "archivePriorityClass" },
  handler: async (ctx, { priorityClassIds }) => {
    await Promise.all(
      priorityClassIds.map((priorityClassId) =>
        checkPriorityClass(ctx, priorityClassId)
      )
    );
    const now = Date.now();
    for (const priorityClassId of priorityClassIds) {
      await ctx.db.patch(priorityClassId, { archivedAt: now });
    }
  },
});

export async function checkPriorityClass(
  ctx: AuthedMutationCtx | AuthedQueryCtx,
  priorityClassId: Id<"priorityClasses">
) {
  const { db, userId } = ctx;
  const priorityClass = await db.get(priorityClassId);
  if (!priorityClass) {
    throw new ConvexError({ message: "Priority class not found" });
  }
  if (priorityClass.userId !== userId) {
    throw new ConvexError({
      message: "Not authorized for this priority class",
    });
  }
  return priorityClass;
}
