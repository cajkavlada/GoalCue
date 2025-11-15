import { pick } from "convex-helpers";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { uniqueField } from "../utils/zodHelpers";

export const unitConvexSchema = convexSchemaFromTable("units");

export type Unit = Infer<typeof unitConvexSchema>;

// create unit convex schema
export const createUnitConvexSchema = v.object(
  pick(unitConvexSchema.fields, ["name", "symbol"])
);

// TODO: infer from convex schema when convexToZod supports zod v4
export function getCreateUnitZodSchema({
  existingUnits,
}: {
  existingUnits: Unit[];
}) {
  return z
    .object({
      name: z
        .string()
        .min(1)
        .pipe(uniqueField({ existing: existingUnits, fieldName: "name" })),
      symbol: z.string().optional(),
    })
    .strict();
}

export type CreateUnitArgs = z.infer<ReturnType<typeof getCreateUnitZodSchema>>;

// update unit convex schema
export const updateUnitConvexSchema = v.object({
  unitId: unitConvexSchema.fields._id,
  ...pick(unitConvexSchema.fields, ["name", "symbol"]),
});

// TODO: infer from convex schema when convexToZod supports zod v4
export function getUpdateUnitZodSchema({
  existingUnits,
  currentUnitId,
}: {
  existingUnits: Unit[];
  currentUnitId: Unit["_id"];
}) {
  return z
    .object({
      name: z
        .string()
        .min(1)
        .pipe(
          uniqueField({
            existing: existingUnits,
            fieldName: "name",
            currentId: currentUnitId,
          })
        ),
      symbol: z.string().optional(),
    })
    .strict();
}

export type UpdateUnitArgs = z.infer<ReturnType<typeof getUpdateUnitZodSchema>>;
