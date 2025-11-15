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

import { priorityClassQueries } from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const getAllForUserId = authedQuery({
  args: {},
  returns: v.array(priorityClassConvexSchema),
  handler: async (ctx) => {
    return priorityClassQueries({ ctx }).getAll();
  },
});

export const create = authedMutation({
  args: createPriorityClassConvexSchema,
  rateLimit: { name: "createPriorityClass" },
  handler: async (ctx, args) => {
    const existingPriorityClasses = await priorityClassQueries({
      ctx,
    }).getAll();

    if (existingPriorityClasses.length === 0) {
      throw new ConvexError({ message: "No priority classes found" });
    }

    await zodParse(
      getCreatePriorityClassZodSchema({
        existingPriorityClasses,
      }),
      args
    );
    return await ctx.db.insert("priorityClasses", {
      ...args,
      userId: ctx.userId,
      orderKey: generateKeyBetween(null, existingPriorityClasses[0]?.orderKey),
    });
  },
});

export const update = authedMutation({
  args: updatePriorityClassConvexSchema,
  rateLimit: { name: "updatePriorityClass" },
  handler: async (ctx, { priorityClassId, ...priorityClassArgs }) => {
    await priorityClassQueries({ ctx }).getOne({ priorityClassId });
    const existingPriorityClasses = await priorityClassQueries({
      ctx,
    }).getAll();
    await zodParse(
      getUpdatePriorityClassZodSchema({
        existingPriorityClasses,
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
        priorityClassQueries({ ctx }).getOne({ priorityClassId })
      )
    );
    const now = Date.now();
    for (const priorityClassId of priorityClassIds) {
      await ctx.db.patch(priorityClassId, { archivedAt: now });
    }
  },
});
