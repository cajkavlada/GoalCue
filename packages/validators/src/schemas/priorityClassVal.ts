import { pick } from "convex-helpers";
import { partial } from "convex-helpers/validators";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

export const priorityClassConvexSchema =
  convexSchemaFromTable("priorityClasses");

export type PriorityClass = Infer<typeof priorityClassConvexSchema>;

// create priority class convex schema
export const createPriorityClassConvexSchema = v.object(
  pick(priorityClassConvexSchema.fields, ["name"])
);

// TODO: infer from convex schema when convexToZod supports zod v4
export const createPriorityClassZodSchema = z
  .object({
    name: z.string().min(1),
  })
  .strict();

export type CreatePriorityClassArgs = z.infer<
  typeof createPriorityClassZodSchema
>;

// update priority class convex schema
export const updatePriorityClassConvexSchema = v.object({
  priorityClassId: priorityClassConvexSchema.fields._id,
  ...partial(pick(priorityClassConvexSchema.fields, ["name", "orderKey"])),
});

// TODO: infer from convex schema when convexToZod supports zod v4
export const updatePriorityClassZodSchema = z
  .object({
    name: z.string().min(1).optional(),
    orderKey: z.string().optional(),
  })
  .strict();

export type UpdatePriorityClassArgs = z.infer<
  typeof updatePriorityClassZodSchema
>;
