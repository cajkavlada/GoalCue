import { pick } from "convex-helpers";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

export const unitConvexSchema = convexSchemaFromTable("units");

export type Unit = Infer<typeof unitConvexSchema>;

// create unit convex schema
export const createUnitConvexSchema = v.object(
  pick(unitConvexSchema.fields, ["name", "symbol"])
);

// TODO: infer from convex schema when convexToZod supports zod v4
export const createUnitZodSchema = z
  .object({
    name: z.string().min(1),
    symbol: z.string().optional(),
  })
  .strict();

export type CreateUnitArgs = z.infer<typeof createUnitZodSchema>;

// update unit convex schema
export const updateUnitConvexSchema = v.object({
  unitId: unitConvexSchema.fields._id,
  ...pick(unitConvexSchema.fields, ["name", "symbol"]),
});

// TODO: infer from convex schema when convexToZod supports zod v4
export const updateUnitZodSchema = z
  .object({
    name: z.string().min(1),
    symbol: z.string().optional(),
  })
  .strict();

export type UpdateUnitArgs = z.infer<typeof updateUnitZodSchema>;
