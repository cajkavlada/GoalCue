import { pick } from "convex-helpers";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

export const taskTypeConvexSchema = convexSchemaFromTable("taskTypes");

export type TaskType = Infer<typeof taskTypeConvexSchema>;

// create task type convex schema
export const createTaskTypeConvexSchema = v.object(
  pick(taskTypeConvexSchema.fields, ["name", "valueKind"])
);

// TODO: infer from convex schema when convexToZod supports zod v4
export const createTaskTypeZodSchema = z.object({
  name: z.string().min(1),
  valueKind: z.enum(["boolean", "number", "enum"]),
});

export type CreateTaskTypeArgs = z.infer<typeof createTaskTypeZodSchema>;
