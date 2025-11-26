import { pick } from "convex-helpers";
import { convexToZod } from "convex-helpers/server/zod4";
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

export function getCreateUnitZodSchema({
  existingUnits,
}: {
  existingUnits: Unit[];
}) {
  return convexToZod(createUnitConvexSchema)
    .extend({
      name: z
        .string()
        .min(1)
        .pipe(uniqueField({ existing: existingUnits, fieldName: "name" })),
    })
    .strict();
}

export type CreateUnitArgs = z.infer<ReturnType<typeof getCreateUnitZodSchema>>;

// update unit convex schema
export const updateUnitConvexSchema = v.object({
  unitId: unitConvexSchema.fields._id,
  ...pick(unitConvexSchema.fields, ["name", "symbol"]),
});

export function getUpdateUnitZodSchema({
  existingUnits,
  currentUnitId,
}: {
  existingUnits: Unit[];
  currentUnitId: Unit["_id"];
}) {
  return convexToZod(updateUnitConvexSchema.omit("unitId"))
    .extend({
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
    })
    .strict();
}

export type UpdateUnitArgs = z.infer<ReturnType<typeof getUpdateUnitZodSchema>>;
