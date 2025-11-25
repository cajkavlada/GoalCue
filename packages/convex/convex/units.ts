import { v } from "convex/values";

import {
  createUnitConvexSchema,
  getCreateUnitZodSchema,
  getUpdateUnitZodSchema,
  unitConvexSchema,
  updateUnitConvexSchema,
  zodParse,
} from "@gc/validators";

import { unitQueries } from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const list = authedQuery({
  args: {},
  returns: v.array(unitConvexSchema),
  handler: async (ctx) => {
    return unitQueries({ ctx }).list();
  },
});

export const create = authedMutation({
  args: createUnitConvexSchema,
  rateLimit: { name: "createUnit" },
  handler: async (ctx, unitArgs) => {
    const existingUnits = await unitQueries({ ctx }).list();
    zodParse(getCreateUnitZodSchema({ existingUnits }), unitArgs);

    return ctx.db.insert("units", {
      ...unitArgs,
      userId: ctx.userId,
    });
  },
});

export const update = authedMutation({
  args: updateUnitConvexSchema,
  rateLimit: { name: "updateUnit" },
  handler: async (ctx, { unitId, ...unitArgs }) => {
    await unitQueries({ ctx }).getById({ unitId });
    const existingUnits = await unitQueries({ ctx }).list();
    zodParse(
      getUpdateUnitZodSchema({ existingUnits, currentUnitId: unitId }),
      unitArgs
    );
    await ctx.db.patch(unitId, unitArgs);
  },
});

export const archive = authedMutation({
  args: {
    unitIds: v.array(unitConvexSchema.fields._id),
  },
  rateLimit: { name: "archiveUnit" },
  handler: async (ctx, { unitIds }) => {
    await Promise.all(
      unitIds.map((unitId) => unitQueries({ ctx }).getById({ unitId }))
    );
    const now = Date.now();
    for (const unitId of unitIds) {
      await ctx.db.patch(unitId, { archivedAt: now });
    }
  },
});
