import { pick } from "convex-helpers";
import { partial } from "convex-helpers/validators";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { uniqueField } from "../utils/zodHelpers";

export const priorityClassConvexSchema =
  convexSchemaFromTable("priorityClasses");

export type PriorityClass = Infer<typeof priorityClassConvexSchema>;

// create priority class convex schema
export const createPriorityClassConvexSchema = v.object(
  pick(priorityClassConvexSchema.fields, ["name"])
);

export function getCreatePriorityClassZodSchema({
  existingPriorityClasses,
}: {
  existingPriorityClasses: PriorityClass[];
}) {
  return z
    .object({
      name: z
        .string()
        .min(1)
        .pipe(
          uniqueField({ existing: existingPriorityClasses, fieldName: "name" })
        ),
    })
    .strict();
}

export type CreatePriorityClassArgs = z.infer<
  ReturnType<typeof getCreatePriorityClassZodSchema>
>;

// update priority class convex schema
export const updatePriorityClassConvexSchema = v.object({
  priorityClassId: priorityClassConvexSchema.fields._id,
  ...partial(pick(priorityClassConvexSchema.fields, ["name", "orderKey"])),
});

export function getUpdatePriorityClassZodSchema({
  existingPriorityClasses,
  currentPriorityClassId,
}: {
  existingPriorityClasses: PriorityClass[];
  currentPriorityClassId: PriorityClass["_id"];
}) {
  return z
    .object({
      name: z
        .string()
        .min(1)
        .pipe(
          uniqueField({
            existing: existingPriorityClasses,
            fieldName: "name",
            currentId: currentPriorityClassId,
          })
        ),
      orderKey: z.string().optional(),
    })
    .strict();
}

export type UpdatePriorityClassArgs = z.infer<
  ReturnType<typeof getUpdatePriorityClassZodSchema>
>;
