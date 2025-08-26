import { omit } from "convex-helpers";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

// convex schema for task action
const taskActionConvexSchema = convexSchemaFromTable("taskActions");

export const addTaskActionConvexSchema = omit(taskActionConvexSchema.fields, [
  "_id",
  "_creationTime",
]);

// zod advanced schema for task action

// TODO: infer from convex schema when convexToZod supports zod v4
const addTaskActionZodSchema = z.object({
  taskId: z.string(),
  note: z.string().optional(),
  boolValue: z.boolean().optional(),
  numValue: z.number().optional(),
  enumOptionId: z.string().optional(),
});

const commonAddFields = addTaskActionZodSchema.pick({
  taskId: true,
  note: true,
});

const boolValue = addTaskActionZodSchema.shape.boolValue;
const numValue = addTaskActionZodSchema.shape.numValue;
const enumOptionId = addTaskActionZodSchema.shape.enumOptionId;

export const addTaskActionAdvancedSchema = z.union([
  commonAddFields.extend({ boolValue }).strict(),
  commonAddFields.extend({ numValue }).strict(),
  commonAddFields.extend({ enumOptionId }).strict(),
]);

export type AddTaskActionArgs = z.infer<typeof addTaskActionAdvancedSchema>;

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

export const taskActionWithValuesSchema = z.discriminatedUnion("valueKind", [
  z
    .object({
      valueKind: z.literal("boolean"),
      boolValue: addTaskActionZodSchema.required().shape.boolValue,
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("number"),
      numValue: addTaskActionZodSchema.required().shape.numValue,
      initialNumValue: taskZodSchema.required().shape.initialNumValue,
      completedNumValue: taskZodSchema.required().shape.completedNumValue,
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("enum"),
      enumOptionId: addTaskActionZodSchema.required().shape.enumOptionId,
      completedEnumOptionId:
        taskTypeZodSchema.required().shape.completedEnumOptionId,
    })
    .strict(),
]);
