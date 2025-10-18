import { pick } from "convex-helpers";
import { Infer, v } from "convex/values";
import z from "zod";

import { CUSTOM_ERROR_REASONS } from "../utils/customErrorReasons";
import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

export const taskTypeConvexSchema = convexSchemaFromTable("taskTypes");

export type TaskType = Infer<typeof taskTypeConvexSchema>;

// create task type convex schema
export const createTaskTypeConvexSchema = v.object(
  pick(taskTypeConvexSchema.fields, [
    "name",
    "valueKind",
    "initialNumValue",
    "completedNumValue",
  ])
);

// TODO: infer from convex schema when convexToZod supports zod v4
export const createTaskTypeZodSchema = z
  .object({
    name: z.string().min(1),
    valueKind: z.enum(["boolean", "number", "enum"]),
    initialNumValue: z.number().optional(),
    completedNumValue: z.number().optional(),
  })
  .superRefine(checkEqualInitialAndCompletedNumValues);

export type CreateTaskTypeArgs = z.infer<typeof createTaskTypeZodSchema>;

export function checkEqualInitialAndCompletedNumValues(
  {
    initialNumValue,
    completedNumValue,
  }: {
    initialNumValue?: TaskType["initialNumValue"];
    completedNumValue?: TaskType["completedNumValue"];
  },
  ctx: z.RefinementCtx
) {
  if (
    initialNumValue !== undefined &&
    completedNumValue !== undefined &&
    initialNumValue === completedNumValue
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["numValues"],
      params: {
        reason: CUSTOM_ERROR_REASONS.EQUAL_INITIAL_AND_COMPLETED_NUM_VALUES,
      },
    });
  }
}
