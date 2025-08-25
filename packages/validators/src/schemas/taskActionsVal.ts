import { omit } from "convex-helpers";
import z from "zod";

import {
  convexSchemaFromTable,
  zodSchemaFromTable,
} from "../utils/dbSchemaHelpers";

// convex schema for task action
const taskActionConvexSchema = convexSchemaFromTable("taskActions");

export const addTaskActionConvexSchema = omit(taskActionConvexSchema.fields, [
  "_id",
  "_creationTime",
]);

// zod advanced schema for task action
const taskActionZodSchema = zodSchemaFromTable("taskActions");

const commonAddFields = taskActionZodSchema.pick({
  taskId: true,
  note: true,
});

const boolValue = taskActionZodSchema.shape.boolValue;
const numValue = taskActionZodSchema.shape.numValue;
const enumOptionId = taskActionZodSchema.shape.enumOptionId;

export const addTaskActionAdvancedSchema = z.union([
  commonAddFields.extend({ boolValue }).strict(),
  commonAddFields.extend({ numValue }).strict(),
  commonAddFields.extend({ enumOptionId }).strict(),
]);

export type AddTaskActionArgs = z.infer<typeof addTaskActionAdvancedSchema>;

// zod schema for task action for corresponding task and task type
const taskZodSchema = zodSchemaFromTable("tasks");
const taskTypeZodSchema = zodSchemaFromTable("taskTypes");

export const taskActionWithValuesSchema = z.discriminatedUnion("valueKind", [
  z
    .object({
      valueKind: z.literal("boolean"),
      boolValue: taskActionZodSchema.required().shape.boolValue,
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("number"),
      numValue: taskActionZodSchema.required().shape.numValue,
      initialNumValue: taskZodSchema.required().shape.initialNumValue,
      completedNumValue: taskZodSchema.required().shape.completedNumValue,
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("enum"),
      enumOptionId: taskActionZodSchema.required().shape.enumOptionId,
      completedEnumOptionId:
        taskTypeZodSchema.required().shape.completedEnumOptionId,
    })
    .strict(),
]);
