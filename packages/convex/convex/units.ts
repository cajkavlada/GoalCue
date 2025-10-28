import { ConvexError, v } from "convex/values";

import {
  createUnitConvexSchema,
  createUnitZodSchema,
  unitConvexSchema,
  updateUnitConvexSchema,
  updateUnitZodSchema,
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
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();
    return units;
  },
});

export const create = authedMutation({
  args: createUnitConvexSchema,
  rateLimit: { name: "createUnit" },
  handler: async (ctx, unitArgs) => {
    await zodParse(createUnitZodSchema, unitArgs);
    await ctx.db.insert("units", {
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
    await zodParse(updateUnitZodSchema, unitArgs);
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
