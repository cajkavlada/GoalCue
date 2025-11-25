import { omit } from "convex-helpers";
import { convexToZod } from "convex-helpers/server/zod4";
import { v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

// convex schema for task action
const taskActionConvexSchema = convexSchemaFromTable("taskActions");

export const addTaskActionConvexSchema = v.object(
  omit(taskActionConvexSchema.fields, ["_id", "_creationTime"])
);

// zod advanced schema for task action
const argsSchema = convexToZod(addTaskActionConvexSchema);

const baseAddFields = argsSchema.pick({
  taskId: true,
  note: true,
});

const boolValue = argsSchema.shape.boolValue;
const numValue = argsSchema.shape.numValue;
const enumOptionId = argsSchema.shape.enumOptionId;

export const addTaskActionZodSchema = z.union([
  baseAddFields.extend({ boolValue }).strict(),
  baseAddFields.extend({ numValue }).strict(),
  baseAddFields.extend({ enumOptionId }).strict(),
]);

export type AddTaskActionArgs = z.infer<typeof addTaskActionZodSchema>;

// zod schema for task action for corresponding task and task type

// TODO: infer from convex schema when convexToZod supports zod v4
const taskZodSchema = z.object({
  initialNumValue: z.number().optional(),
  completedNumValue: z.number().optional(),
});

// TODO: infer from convex schema when convexToZod supports zod v4
const taskTypeZodSchema = z.object({
  completedEnumOptionId: z.string().optional(),
});

export const taskActionWithBorderValuesSchema = z.discriminatedUnion(
  "valueKind",
  [
    z
      .object({
        valueKind: z.literal("boolean"),
        ...argsSchema.required().pick({ boolValue: true }).shape,
      })
      .strict(),
    z
      .object({
        valueKind: z.literal("number"),
        ...argsSchema.required().pick({ numValue: true }).shape,
        ...taskZodSchema
          .required()
          .pick({ initialNumValue: true, completedNumValue: true }).shape,
      })
      .strict(),
    z
      .object({
        valueKind: z.literal("enum"),
        ...argsSchema.required().pick({ enumOptionId: true }).shape,
        ...taskTypeZodSchema.required().pick({ completedEnumOptionId: true })
          .shape,
      })
      .strict(),
  ]
);
