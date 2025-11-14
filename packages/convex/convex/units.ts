import { ConvexError, v } from "convex/values";

import {
  createUnitConvexSchema,
  getCreateUnitZodSchema,
  getUpdateUnitZodSchema,
  unitConvexSchema,
  updateUnitConvexSchema,
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
  returns: v.array(unitConvexSchema),
  handler: async ({ db, userId }) => {
    const units = await db
      .query("units")
      .withIndex("by_userId", (q) =>
        q.eq("userId", userId).eq("archivedAt", undefined)
      )
      .collect();
    return units;
  },
});

export const create = authedMutation({
  args: createUnitConvexSchema,
  rateLimit: { name: "createUnit" },
  handler: async (ctx, unitArgs) => {
    const existingUnits = await ctx.db
      .query("units")
      .withIndex("by_userId", (q) =>
        q.eq("userId", ctx.userId).eq("archivedAt", undefined)
      )
      .collect();
    await zodParse(getCreateUnitZodSchema({ existingUnits }), unitArgs);
    return await ctx.db.insert("units", {
      ...unitArgs,
      userId: ctx.userId,
    });
  },
});

export const update = authedMutation({
  args: updateUnitConvexSchema,
  rateLimit: { name: "updateUnit" },
  handler: async (ctx, { unitId, ...unitArgs }) => {
    await checkUnit(ctx, unitId);
    const existingUnits = await ctx.db
      .query("units")
      .withIndex("by_userId", (q) =>
        q.eq("userId", ctx.userId).eq("archivedAt", undefined)
      )
      .collect();
    await zodParse(
      getUpdateUnitZodSchema({ existingUnits, currentUnitId: unitId }),
      unitArgs
    );
    await ctx.db.patch(unitId, {
      ...unitArgs,
    });
  },
});

export const archive = authedMutation({
  args: {
    unitIds: v.array(unitConvexSchema.fields._id),
  },
  rateLimit: { name: "archiveUnit" },
  handler: async (ctx, { unitIds }) => {
    await Promise.all(unitIds.map((unitId) => checkUnit(ctx, unitId)));
    const now = Date.now();
    for (const unitId of unitIds) {
      await ctx.db.patch(unitId, { archivedAt: now });
    }
  },
});

export async function checkUnit(
  ctx: AuthedMutationCtx | AuthedQueryCtx,
  unitId: Id<"units">
) {
  const { db, userId } = ctx;
  const unit = await db.get(unitId);
  if (!unit) {
    throw new ConvexError({ message: "Unit not found" });
  }
  if (unit.userId !== userId) {
    throw new ConvexError({ message: "Not authorized for this unit" });
  }
  return unit;
}
